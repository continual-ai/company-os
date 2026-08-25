/* oxlint-disable anti-slop/no-runtime-typeof */
import { fileURLToPath } from "node:url"

import { Model } from "@company/model"
import { createClient } from "@company/runtime/client"
import { PgliteClient } from "@effect/sql-pglite"
import * as PgliteDrizzle from "drizzle-orm/effect-pglite"
import { migrate } from "drizzle-orm/effect-pglite/migrator"
import { Effect, Layer, ManagedRuntime, Redacted } from "effect"
import { describe, expect, it } from "vitest"

import { makeApplicationLayer } from "./application-layer"
import { AuthSettings, type AuthConfig } from "./auth/auth-config"
import { AuthProtocol } from "./auth/auth-protocol"
import { UserAuthentication } from "./auth/user-authentication"
import { CompanyApi } from "./company-api"
import { Database } from "./database/database"
import { authUser, relations } from "./database/schema"
import { seedSystem } from "./seeds/seed-system"

const migrationsFolder = fileURLToPath(
  new URL("database/migrations", import.meta.url)
)
const TestDatabase = PgliteClient.layer()

const authConfig: AuthConfig = {
  baseUrl: "http://company.test",
  bootstrapEmail: undefined,
  cookiePrefix: "company_os_test",
  oidc: {
    clientId: "client-id",
    clientSecret: Redacted.make("client-secret"),
    discoveryUrl:
      "https://accounts.example.com/.well-known/openid-configuration",
    name: "Single sign-on",
  },
  secret: Redacted.make("a-secure-value-with-at-least-32-characters"),
}

const testAuthProtocol = {
  handle: (_request: Request) => Effect.die("Not used by Company API tests"),
  session: (_headers: Headers) =>
    Effect.succeed({
      authUserId: "auth_owner",
      email: "owner@example.com",
      emailVerified: true,
      name: "Owner",
    }),
} satisfies typeof AuthProtocol.Service

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

describe("Company API", () => {
  it("assembles generated CRUD and custom actions into one Fetch handler", async () => {
    await run(
      Effect.gen(function* () {
        const pglite = yield* PgliteDrizzle.makeWithDefaults({ relations })
        yield* migrate(pglite, { migrationsFolder })
        const database = asDatabase(pglite)
        yield* seedSystem().pipe(Effect.provideService(Database, database))
        const now = new Date()
        yield* database.insert(authUser).values({
          createdAt: now,
          email: "owner@example.com",
          emailVerified: true,
          id: "auth_owner",
          name: "Owner",
          updatedAt: now,
        })

        const runtime = ManagedRuntime.make(
          makeApplicationLayer({
            authProtocol: Layer.succeed(AuthProtocol, testAuthProtocol),
            authSettings: Layer.succeed(AuthSettings, authConfig),
            database: Layer.succeed(Database, database),
          })
        )
        const userAuthentication = yield* Effect.promise(() =>
          runtime.runPromise(UserAuthentication)
        )
        yield* Effect.promise(() =>
          runtime.runPromise(userAuthentication.authenticate(new Headers()))
        )
        const api = yield* Effect.promise(() => runtime.runPromise(CompanyApi))
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
            violations: [
              {
                path: ["domain"],
                reason: "INVALID",
              },
            ],
          },
          reason: "VALIDATION_FAILED",
          status: "INVALID_ARGUMENT",
        })

        const client = createClient(Model, {
          baseUrl: "http://company.test/api/v1",
          fetch: async (input, init) => {
            const url =
              typeof input === "string"
                ? input
                : input instanceof URL
                  ? input.href
                  : input.url
            const response = await runtime.runPromise(
              api.handle(new Request(url, init))
            )
            if (response.status >= 500) {
              throw new Error(
                `Company API returned ${response.status}: ${await response.text()}`
              )
            }
            return response
          },
        })

        const initial = yield* Effect.promise(() =>
          client.companies.list({ pageSize: 10 })
        )
        expect(initial).toEqual({ items: [], nextPageToken: "" })

        const created = yield* Effect.promise(() =>
          client.companies.create({
            name: "Northstar",
          })
        )
        expect(created).toMatchObject({
          lifecycleStage: "prospect",
          name: "Northstar",
        })

        const listed = yield* Effect.promise(() =>
          client.companies.list({ pageSize: 10 })
        )
        expect(listed.items).toHaveLength(1)

        const serviceAccount = yield* Effect.promise(() =>
          client.serviceAccounts.create({ name: "Import worker" })
        )
        yield* Effect.promise(() =>
          client.serviceAccounts.disable({ id: serviceAccount.id })
        )
        const disabled = yield* Effect.promise(() =>
          client.serviceAccounts.get({ id: serviceAccount.id })
        )
        expect(disabled.status).toBe("disabled")

        yield* Effect.promise(() => runtime.dispose())
      })
    )
  })
})
