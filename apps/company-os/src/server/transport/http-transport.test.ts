/* oxlint-disable anti-slop/no-runtime-typeof */
import { fileURLToPath } from "node:url"

import { Model } from "@company/model"
import { isStandardActionId } from "@company/runtime"
import { httpEndpointId } from "@company/runtime/effect/http"
import { executableModelOperations } from "@company/runtime/effect/model-implementation"
import { PgliteClient } from "@effect/sql-pglite"
import { eq } from "drizzle-orm"
import * as PgliteDrizzle from "drizzle-orm/effect-pglite"
import { migrate } from "drizzle-orm/effect-pglite/migrator"
import { Effect, Layer, ManagedRuntime, Schema } from "effect"
import { FetchHttpClient } from "effect/unstable/http"
import { HttpApiClient, OpenApi } from "effect/unstable/httpapi"
import { describe, expect, it } from "vitest"

import { applicationHttpApi } from "@/http-api"
import type { ApplicationHttpClient } from "@/http-client"
import { makeApplicationLayer } from "@/server/application-layer"
import { AuthSettings, type AuthConfig } from "@/server/auth/auth-config"
import { IdentityProvider } from "@/server/auth/identity-provider"
import { Database } from "@/server/database/database"
import {
  identityBindings,
  objects,
  relations,
  roleAssignments,
  users,
} from "@/server/database/schema"
import { seedSystem } from "@/server/seeds/seed-system"
import { ROOT_ID } from "@/system-records"

import { HttpTransport } from "./http-transport"
import { McpTransport } from "./mcp-transport"

const migrationsFolder = fileURLToPath(
  new URL("../database/migrations", import.meta.url)
)
const TestDatabase = PgliteClient.layer()

const authConfig: AuthConfig = {
  provider: {
    cookieName: "company-os-local-identity",
    kind: "local",
    profiles: [
      {
        email: "owner@example.com",
        id: "owner",
        name: "Owner",
        provisioningRole: "administrator",
        subject: "owner",
      },
    ],
  },
  provisioningRole: "administrator",
}

const testIdentityProvider = {
  identify: (headers: Headers) => {
    if (headers.has("x-test-anonymous")) return Effect.succeed(null)
    const authorizationSubject = {
      email: headers.has("x-test-renamed")
        ? "renamed@example.com"
        : "owner@example.com",
      issuer: "https://identity.example.com",
      kind: "user" as const,
      name: headers.has("x-test-renamed") ? "Renamed Owner" : "Owner",
      subject: "owner",
    }
    return Effect.succeed({
      actor: headers.has("x-test-delegated")
        ? {
            email: undefined,
            issuer: "https://identity.example.com",
            kind: "serviceAccount" as const,
            name: "Portfolio agent",
            subject: "portfolio-agent",
          }
        : authorizationSubject,
      authorizationSubject,
    })
  },
} satisfies typeof IdentityProvider.Service

function asDatabase(
  database: Effect.Success<
    ReturnType<typeof PgliteDrizzle.makeWithDefaults<typeof relations>>
  >
): typeof Database.Service {
  // SAFETY: Effect PostgreSQL and PGlite expose the same Drizzle transaction API.
  // oxlint-disable-next-line anti-slop/no-chained-type-assertions, typescript/no-unsafe-type-assertion
  return database as unknown as typeof Database.Service
}

function run<A, E>(effect: Effect.Effect<A, E, PgliteClient.PgliteClient>) {
  return Effect.runPromise(
    Effect.scoped(effect.pipe(Effect.provide(TestDatabase)))
  )
}

const modelProjectionContract = executableModelOperations(Model).map(
  ({ definition, key, object }) => ({
    httpOperationId: httpEndpointId(
      definition.id,
      object,
      definition.kind === "action" && !isStandardActionId(definition.id)
        ? definition.scope
        : undefined
    ),
    mcpToolName: key,
  })
)

const httpOperationIds = new Set(
  Object.values(OpenApi.fromApi(applicationHttpApi).paths).flatMap((path) =>
    [path.delete, path.get, path.patch, path.post, path.put].flatMap(
      (operation) => operation?.operationId ?? []
    )
  )
)

describe("application HTTP server", () => {
  it("assembles generated CRUD, JIT identity, and anonymous authorization", async () => {
    await run(
      Effect.gen(function* () {
        const pglite = yield* PgliteDrizzle.makeWithDefaults({ relations })
        yield* migrate(pglite, { migrationsFolder })
        const database = asDatabase(pglite)
        yield* seedSystem().pipe(Effect.provideService(Database, database))

        const runtime = ManagedRuntime.make(
          makeApplicationLayer({
            authSettings: Layer.succeed(AuthSettings, authConfig),
            database: Layer.succeed(Database, database),
            identityProvider: Layer.succeed(
              IdentityProvider,
              testIdentityProvider
            ),
          })
        )
        const api = yield* Effect.promise(() =>
          runtime.runPromise(HttpTransport)
        )
        const mcp = yield* Effect.promise(() =>
          runtime.runPromise(McpTransport)
        )
        const rejectedMcpOrigin = yield* Effect.promise(() =>
          runtime.runPromise(
            mcp.handle(
              new Request("http://localhost/api/mcp", {
                body: JSON.stringify({
                  id: 1,
                  jsonrpc: "2.0",
                  method: "tools/list",
                }),
                headers: {
                  accept: "application/json, text/event-stream",
                  "content-type": "application/json",
                  host: "localhost",
                  origin: "https://attacker.example",
                },
                method: "POST",
              })
            )
          )
        )
        expect(rejectedMcpOrigin.status).toBe(403)

        const listedMcpTools = yield* Effect.promise(() =>
          runtime.runPromise(
            mcp.handle(
              new Request("http://localhost/api/mcp", {
                body: JSON.stringify({
                  id: 2,
                  jsonrpc: "2.0",
                  method: "tools/list",
                }),
                headers: {
                  accept: "application/json, text/event-stream",
                  "content-type": "application/json",
                  host: "localhost",
                },
                method: "POST",
              })
            )
          )
        )
        expect(listedMcpTools.status).toBe(200)
        const listedMcpBody = yield* Effect.promise(() => listedMcpTools.text())
        const listedMcpJson = listedMcpBody
          .split("\n")
          .find((line) => line.startsWith("data:"))
          ?.slice("data:".length)
          .trim()
        const listedMcpPayload = Schema.decodeUnknownSync(
          Schema.Struct({
            result: Schema.Struct({
              tools: Schema.Array(Schema.Struct({ name: Schema.String })),
            }),
          })
        )(JSON.parse(listedMcpJson ?? listedMcpBody))
        const mcpToolNames = new Set(
          listedMcpPayload.result.tools.map(({ name }) => name)
        )
        expect(
          modelProjectionContract.filter(
            ({ mcpToolName }) => !mcpToolNames.has(mcpToolName)
          )
        ).toEqual([])
        expect(
          modelProjectionContract.filter(
            ({ httpOperationId }) => !httpOperationIds.has(httpOperationId)
          )
        ).toEqual([])
        const anonymousCapabilities = yield* Effect.promise(() =>
          runtime.runPromise(
            api.handle(
              new Request("http://company.test/api/v1/capabilities:check", {
                body: JSON.stringify({
                  checks: [{ permission: "company.create", target: ROOT_ID }],
                }),
                headers: {
                  "content-type": "application/json",
                  "x-test-anonymous": "true",
                },
                method: "POST",
              })
            )
          )
        )
        expect(anonymousCapabilities.status).toBe(200)
        expect(
          yield* Effect.promise(() => anonymousCapabilities.json())
        ).toEqual({ results: [{ allowed: false }] })

        const invalidCompany = yield* Effect.promise(() =>
          runtime.runPromise(
            api.handle(
              new Request("http://company.test/api/v1/companies", {
                body: JSON.stringify({ domain: "test", name: "Invalid" }),
                headers: { "content-type": "application/json" },
                method: "POST",
              })
            )
          )
        )
        expect(invalidCompany.status).toBe(400)
        expect(
          yield* Effect.promise(() => invalidCompany.json())
        ).toMatchObject({
          details: {
            violations: [{ path: ["domain"], reason: "INVALID" }],
          },
          reason: "VALIDATION_FAILED",
          status: "INVALID_ARGUMENT",
        })

        const fetchApi: typeof globalThis.fetch = async (input, init) => {
          const url =
            typeof input === "string"
              ? input
              : input instanceof URL
                ? input.href
                : input.url
          return runtime.runPromise(api.handle(new Request(url, init)))
        }
        const nativeClient = yield* HttpApiClient.make(applicationHttpApi, {
          baseUrl: "http://company.test",
        }).pipe(Effect.provide(FetchHttpClient.layer))
        // SAFETY: applicationHttpApi is projected from the same closed Model
        // represented by ApplicationHttpClient.
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        const client = nativeClient as ApplicationHttpClient
        const useTestFetch = <A, E>(effect: Effect.Effect<A, E>) =>
          effect.pipe(Effect.provideService(FetchHttpClient.Fetch, fetchApi))

        const capabilities = yield* useTestFetch(
          client.capabilities.checkCapabilities({
            payload: {
              checks: [
                { permission: "company.create", target: ROOT_ID },
                { permission: "lead.convert", target: "missing-lead" },
              ],
            },
          })
        )
        expect(capabilities.results).toEqual([
          { allowed: true },
          { allowed: false },
        ])

        const initial = yield* useTestFetch(
          client.company.listCompanies({ query: { pageSize: 10 } })
        )
        expect(initial).toEqual({ items: [], nextPageToken: "" })

        const created = yield* useTestFetch(
          client.company.createCompany({ payload: { name: "Northstar" } })
        )
        expect(created).toMatchObject({
          lifecycleStage: "prospect",
          name: "Northstar",
        })

        const listedUsers = yield* useTestFetch(
          client.user.listUsers({ query: { pageSize: 10 } })
        )
        expect(listedUsers.items).toEqual([
          expect.objectContaining({
            email: "owner@example.com",
            name: "Owner",
          }),
        ])

        const delegatedResponse = yield* Effect.promise(() =>
          runtime.runPromise(
            api.handle(
              new Request("http://company.test/api/v1/companies", {
                body: JSON.stringify({ name: "Delegated Company" }),
                headers: {
                  "content-type": "application/json",
                  "x-test-delegated": "true",
                },
                method: "POST",
              })
            )
          )
        )
        expect(delegatedResponse.status).toBe(201)
        const delegated = Schema.decodeUnknownSync(
          Schema.Struct({ id: Schema.String })
        )(yield* Effect.promise(() => delegatedResponse.json()))
        const [actorBinding] = yield* database
          .select({ identityId: identityBindings.identityId })
          .from(identityBindings)
          .where(eq(identityBindings.subject, "portfolio-agent"))
        expect(actorBinding).toBeDefined()
        const actorIdentityId = Schema.decodeUnknownSync(Schema.String)(
          actorBinding?.identityId
        )
        const [delegatedObject] = yield* database
          .select({ createdById: objects.createdById })
          .from(objects)
          .where(eq(objects.id, delegated.id))
        expect(delegatedObject?.createdById).toBe(actorIdentityId)
        const actorRoles = yield* database
          .select({ id: roleAssignments.id })
          .from(roleAssignments)
          .where(eq(roleAssignments.principalId, actorIdentityId))
        expect(actorRoles).toEqual([])

        const renamedResponse = yield* Effect.promise(() =>
          runtime.runPromise(
            api.handle(
              new Request("http://company.test/api/v1/capabilities:check", {
                body: JSON.stringify({
                  checks: [{ permission: "company.create", target: ROOT_ID }],
                }),
                headers: {
                  "content-type": "application/json",
                  "x-test-renamed": "true",
                },
                method: "POST",
              })
            )
          )
        )
        expect(renamedResponse.status).toBe(200)
        const [reconciledUser] = yield* database
          .select({ email: users.email, name: users.name })
          .from(users)
          .where(eq(users.id, created.createdBy))
        expect(reconciledUser).toEqual({
          email: "renamed@example.com",
          name: "Renamed Owner",
        })

        yield* Effect.promise(() => runtime.dispose())
      })
    )
  })
})
