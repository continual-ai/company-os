import { Model } from "@company/model"
import { makeLinkRepository } from "@company/postgres"
import { isStandardActionId, RecordAlias } from "@company/runtime"
import {
  createModelClient,
  httpEndpointId,
  linkHttpEndpointId,
  type ModelHttpClient,
} from "@company/runtime/effect/http-client"
import { executableModelOperations } from "@company/runtime/effect/model-implementation"
import { eq } from "drizzle-orm"
import { Effect, Layer, ManagedRuntime, Schema } from "effect"
import { FetchHttpClient } from "effect/unstable/http"
import { HttpApiClient, OpenApi } from "effect/unstable/httpapi"
import { describe, expect, vi } from "vitest"

import { applicationHttpApi } from "@/http-api"
import type { capabilityGroup } from "@/http-api"
import { makeApplicationKeys } from "@/server/application-keys"
import { makeApplicationLayer } from "@/server/application-layer"
import { Database } from "@/server/database/database"
import { itDatabase } from "@/server/database/it-database"
import {
  identityBindings,
  notes,
  objects,
  roleAssignments,
  Storage,
  users,
} from "@/server/database/schema"
import { makeEncryptedPageTokenCodec, PageTokens } from "@/server/page-tokens"
import { seedSystem } from "@/server/seeds/seed-system"
import { ADMINISTRATOR_ROLE_ID, ROOT_ID } from "@/system-records"

import { HttpTransport } from "./http-transport"
import { McpTransport } from "./mcp-transport"

type ApplicationHttpClient = ModelHttpClient<typeof Model> &
  HttpApiClient.Client<typeof capabilityGroup>

const testPageTokens = makeEncryptedPageTokenCodec(
  makeApplicationKeys(
    "http-transport-test-application-secret-at-least-32-bytes"
  ).deriveKey("http-transport-page-token-test:v1")
)

const runtimeHeaders = {
  "x-continual-app-runtime-assertion": "runtime-assertion",
  "x-continual-app-runtime-origin": "https://continual.example",
}

function projectedHttpId(
  descriptor: ReturnType<typeof executableModelOperations>[number]
): string {
  const { definition, linkTraversal, object } = descriptor
  if (linkTraversal !== undefined) {
    if (
      definition.id !== "link" &&
      definition.id !== "list" &&
      definition.id !== "unlink"
    ) {
      throw new Error(`Link operation '${descriptor.key}' is invalid.`)
    }
    return linkHttpEndpointId(definition.id, object, linkTraversal)
  }
  return httpEndpointId(
    definition.id,
    object,
    definition.kind === "action" && !isStandardActionId(definition.id)
      ? definition.scope
      : undefined
  )
}

const modelProjectionContract = executableModelOperations(Model).map(
  (descriptor) => ({
    httpOperationId: projectedHttpId(descriptor),
    mcpToolName: descriptor.key,
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
  itDatabase(
    "assembles generated CRUD with Continual identity and anonymous authorization",
    Effect.fn(function* () {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          Response.json({
            actorId: "us_test",
            email: "owner@example.com",
            name: "Owner",
          })
        )
      )
      const database = yield* Database
      yield* seedSystem().pipe(
        Effect.provideService(PageTokens, testPageTokens)
      )

      const runtime = yield* Effect.acquireRelease(
        Effect.sync(() =>
          ManagedRuntime.make(
            makeApplicationLayer({
              database: Layer.succeed(Database, database),
              pageTokens: Layer.succeed(PageTokens, testPageTokens),
            })
          )
        ),
        (managedRuntime) => Effect.promise(() => managedRuntime.dispose())
      )

      const api = yield* Effect.promise(() => runtime.runPromise(HttpTransport))
      const mcp = yield* Effect.promise(() => runtime.runPromise(McpTransport))
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
              },
              method: "POST",
            })
          )
        )
      )
      expect(anonymousCapabilities.status).toBe(200)
      expect(yield* Effect.promise(() => anonymousCapabilities.json())).toEqual(
        { results: [{ allowed: false }] }
      )

      const invalidCompany = yield* Effect.promise(() =>
        runtime.runPromise(
          api.handle(
            new Request("http://company.test/api/v1/companies", {
              body: JSON.stringify({ domain: "test", name: "Invalid" }),
              headers: {
                "content-type": "application/json",
                ...runtimeHeaders,
              },
              method: "POST",
            })
          )
        )
      )
      expect(invalidCompany.status).toBe(400)
      expect(yield* Effect.promise(() => invalidCompany.json())).toMatchObject({
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
        const headers = new Headers(init?.headers)
        for (const [name, value] of Object.entries(runtimeHeaders)) {
          headers.set(name, value)
        }
        return runtime.runPromise(
          api.handle(new Request(url, { ...init, headers }))
        )
      }
      const nativeClient = yield* HttpApiClient.make(applicationHttpApi, {
        baseUrl: "http://company.test",
      }).pipe(Effect.provide(FetchHttpClient.layer))
      // SAFETY: applicationHttpApi is projected from the same closed Model
      // represented by ApplicationHttpClient.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      const client = nativeClient as ApplicationHttpClient
      // SAFETY: the native Effect client is generated from this same Model.
      const model = createModelClient(Model, nativeClient)
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

      const initial = yield* useTestFetch(model.company.list({ pageSize: 10 }))
      expect(initial).toEqual({
        items: [],
        nextPageToken: null,
        totalSize: 0,
      })

      const created = yield* useTestFetch(
        model.company.create({ name: "Northstar" })
      )
      expect(created).toMatchObject({
        lifecycleStage: "prospect",
        name: "Northstar",
      })
      const note = yield* useTestFetch(
        model.note.create({
          content: "Introductory call",
          links: { subjects: [created.id] },
        })
      )
      expect(
        yield* useTestFetch(model.note.subjects.list({ id: note.id }))
      ).toEqual({
        items: [{ id: created.id, objectType: "company" }],
        nextPageToken: null,
        totalSize: 1,
      })
      const contact = yield* useTestFetch(
        model.contact.create({
          links: { primaryCompany: created.id },
          name: "Ada Lovelace",
        })
      )
      expect(
        yield* makeLinkRepository(Storage, database, testPageTokens).list({
          direction: "reverse",
          linkId: "contactPrimaryCompany",
          pageSize: 10,
          sourceId: created.id,
        })
      ).toEqual({
        items: [{ id: contact.id, objectType: "contact" }],
        nextPageToken: null,
        totalSize: 1,
      })
      const linkedContacts = yield* useTestFetch(
        model.company.contacts.list({ id: created.id })
      )
      expect(linkedContacts.items).toEqual([
        { id: contact.id, objectType: "contact" },
      ])
      const secondContact = yield* useTestFetch(
        model.contact.create({ name: "Grace Hopper" })
      )
      const updated = yield* useTestFetch(
        model.company.update({
          etag: created.etag,
          id: created.id,
          links: {
            contacts: {
              add: [secondContact.id],
              remove: [contact.id],
            },
          },
          name: "Northstar Systems",
        })
      )
      expect(updated.name).toBe("Northstar Systems")
      expect(
        yield* useTestFetch(model.company.contacts.list({ id: created.id }))
      ).toEqual({
        items: [{ id: secondContact.id, objectType: "contact" }],
        nextPageToken: null,
        totalSize: 1,
      })
      expect(
        yield* Effect.flip(
          useTestFetch(
            model.company.update({
              etag: updated.etag,
              id: created.id,
              links: {
                contacts: {
                  add: [RecordAlias("test:contact:missing")],
                },
              },
              name: "This must roll back",
            })
          )
        )
      ).toMatchObject({ reason: "NOT_FOUND" })
      expect(
        yield* useTestFetch(model.company.list({ pageSize: 10 }))
      ).toMatchObject({
        items: [expect.objectContaining({ name: "Northstar Systems" })],
      })
      yield* useTestFetch(
        model.company.contacts.unlink({
          id: created.id,
          target: contact.id,
        })
      )
      expect(
        yield* useTestFetch(model.company.contacts.list({ id: created.id }))
      ).toEqual({
        items: [{ id: secondContact.id, objectType: "contact" }],
        nextPageToken: null,
        totalSize: 1,
      })
      yield* useTestFetch(
        model.company.contacts.link({
          id: created.id,
          target: contact.id,
        })
      )
      expect(
        yield* useTestFetch(
          model.contact.primaryCompany.list({ id: contact.id })
        )
      ).toEqual({
        items: [{ id: created.id, objectType: "company" }],
        nextPageToken: null,
        totalSize: 1,
      })

      const firstContactPage = yield* useTestFetch(
        model.company.contacts.list({ id: created.id, pageSize: 1 })
      )
      expect(firstContactPage.items).toHaveLength(1)
      expect(firstContactPage.nextPageToken).not.toBeNull()
      expect(firstContactPage.totalSize).toBe(2)
      const nextContactPageToken =
        firstContactPage.nextPageToken === null
          ? yield* Effect.die("Expected another contact page")
          : firstContactPage.nextPageToken
      expect(nextContactPageToken.length).toBeLessThan(256)
      const mismatchedLinkCursor = yield* makeLinkRepository(
        Storage,
        database,
        testPageTokens
      )
        .list({
          direction: "reverse",
          linkId: "contactPrimaryCompany",
          pageSize: 1,
          pageToken: nextContactPageToken,
          sourceId: ROOT_ID,
        })
        .pipe(Effect.flip)
      expect(mismatchedLinkCursor).toMatchObject({
        message: "The page token does not match this list request.",
      })
      const secondContactPage = yield* useTestFetch(
        model.company.contacts.list({
          id: created.id,
          pageSize: 1,
          pageToken: nextContactPageToken,
        })
      )
      expect(secondContactPage.items).toHaveLength(1)
      expect(secondContactPage.nextPageToken).toBeNull()
      expect(secondContactPage.totalSize).toBe(2)
      expect(
        yield* makeLinkRepository(Storage, database, testPageTokens).list(
          {
            direction: "reverse",
            linkId: "contactPrimaryCompany",
            pageSize: 1,
            sourceId: created.id,
          },
          {
            targets: [
              {
                objectType: "contact",
                visibleWithin: [secondContact.id],
              },
            ],
          }
        )
      ).toEqual({
        items: [{ id: secondContact.id, objectType: "contact" }],
        nextPageToken: null,
        totalSize: 1,
      })

      const destination = yield* useTestFetch(
        model.company.create({ name: "Analytical Engine" })
      )
      yield* useTestFetch(
        model.company.contacts.link({
          id: destination.id,
          target: contact.id,
        })
      )
      yield* useTestFetch(
        model.company.contacts.link({
          id: destination.id,
          target: contact.id,
        })
      )
      expect(
        yield* useTestFetch(
          model.contact.primaryCompany.list({ id: contact.id })
        )
      ).toEqual({
        items: [{ id: destination.id, objectType: "company" }],
        nextPageToken: null,
        totalSize: 1,
      })
      expect(
        yield* useTestFetch(model.company.contacts.list({ id: created.id }))
      ).toEqual({
        items: [{ id: secondContact.id, objectType: "contact" }],
        nextPageToken: null,
        totalSize: 1,
      })

      yield* useTestFetch(
        model.company.delete({ etag: updated.etag, id: created.id })
      )
      expect(
        yield* useTestFetch(model.note.subjects.list({ id: note.id }))
      ).toEqual({
        items: [],
        nextPageToken: null,
        totalSize: 0,
      })
      const [persistedNote] = yield* database
        .select({ content: notes.content })
        .from(notes)
        .where(eq(notes.id, note.id))
      expect(persistedNote).toEqual({ content: "Introductory call" })
      const [auditedObject] = yield* database
        .select({ createdById: objects.createdById })
        .from(objects)
        .where(eq(objects.id, destination.id))
      expect(auditedObject?.createdById).toBe("us_test")
      const [projectedUser] = yield* database
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(eq(users.id, "us_test"))
      expect(projectedUser).toEqual({ id: "us_test", name: "Owner" })
      const [binding] = yield* database
        .select({ identityId: identityBindings.identityId })
        .from(identityBindings)
        .where(eq(identityBindings.subject, "us_test"))
      expect(binding).toEqual({ identityId: "us_test" })
      const [assignment] = yield* database
        .select({
          principalId: roleAssignments.principalId,
          roleId: roleAssignments.roleId,
        })
        .from(roleAssignments)
        .where(eq(roleAssignments.principalId, "us_test"))
      expect(assignment).toEqual({
        principalId: "us_test",
        roleId: ADMINISTRATOR_ROLE_ID,
      })
    }),
    10_000
  )
})
