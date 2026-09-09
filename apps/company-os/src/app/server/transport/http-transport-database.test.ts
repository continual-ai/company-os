import {
  ConfigProvider,
  Effect,
  Layer,
  ManagedRuntime,
  Schema,
  Stream,
} from "effect"
import { OpenApi } from "effect/unstable/httpapi"
import { describe, expect, vi } from "vitest"

import { Model } from "#/app.model.ts"
import { createEventConsumer } from "#/app/client/event-consumer.ts"
import { makeApplicationLayer } from "#/app/server/application-layer.ts"
import { Storage } from "#/app/server/database/schema.ts"
import { applicationHttpApi } from "#/app/server/http-api.ts"
import { testApplication } from "#/app/server/test-application.ts"
import { HttpTransport } from "#/app/server/transport/http-transport.ts"
import { McpTransport } from "#/app/server/transport/mcp-transport.ts"
import {
  createEffectClient,
  runClientEffect,
} from "#/runtime/client/create-client.ts"
import { createModelDataClient } from "#/runtime/client/data-client.ts"
import { modelQuery } from "#/runtime/client/model-query-client.ts"
import {
  eventPageSchema,
  InvalidEventCursor,
} from "#/runtime/contract/events.ts"
import {
  httpEndpointId,
  linkHttpEndpointId,
} from "#/runtime/contract/http-endpoint.ts"
import { isStandardActionId, RecordAlias } from "#/runtime/model/index.ts"
import { executableModelOperations } from "#/runtime/model/operations.ts"
import {
  ADMINISTRATOR_ROLE_ID,
  ROOT_ID,
} from "#/runtime/model/system-records.ts"
import { makeApplicationKeys } from "#/runtime/server/application-keys.ts"
import {
  makeEncryptedPageTokenCodec,
  PageTokens,
} from "#/runtime/server/page-tokens.ts"
import { Database } from "#/runtime/server/storage/database.ts"
import { assignments } from "#/runtime/server/storage/index.ts"
import {
  projection,
  type SelectionRow,
} from "#/runtime/server/storage/index.ts"
import { makeLinkRepository } from "#/runtime/server/storage/index.ts"
import { identityBindings } from "#/runtime/server/storage/infrastructure.ts"

const application = testApplication()
const { objects } = Storage.core
const {
  note: notes,
  roleAssignment: roleAssignments,
  user: users,
} = Storage.objects

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
    (definition.kind === "action" && !isStandardActionId(definition.id)) ||
      (definition.kind === "query" && "input" in definition)
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
  application.test(
    "assembles generated CRUD with Continual identity and anonymous authorization",
    () =>
      Effect.gen(function* () {
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
        const sql = database.sql

        const runtime = yield* Effect.acquireRelease(
          Effect.sync(() =>
            ManagedRuntime.make(
              makeApplicationLayer({
                database: Layer.succeed(Database, database),
                pageTokens: Layer.succeed(PageTokens, testPageTokens),
              }).pipe(
                Layer.provide(
                  ConfigProvider.layer(
                    ConfigProvider.fromEnvRecord({
                      CONTINUAL_URL: "https://continual.example",
                      AUTH_BOOTSTRAP_SUBJECT: "us_test",
                    })
                  )
                )
              )
            )
          ),
          (managedRuntime) => Effect.promise(() => managedRuntime.dispose())
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
          const headers = new Headers(init?.headers)
          for (const [name, value] of Object.entries(runtimeHeaders)) {
            headers.set(name, value)
          }
          return runtime.runPromise(
            api.handle(new Request(url, { ...init, headers }))
          )
        }
        // The complete Model is enabled here, so its contract matches the served one.
        const model = createEffectClient(Model, {
          baseUrl: "http://company.test",
          fetch: fetchApi,
        })

        const ticket = yield* model.ticket.create({
          subject: "HTTP to MCP escalation",
        })

        const escalation = yield* model.escalation.createIssue({
          ticket: ticket.id,
        })

        const repeated = yield* Effect.promise(() =>
          runtime.runPromise(
            mcp.handle(
              new Request("http://localhost/api/mcp", {
                method: "POST",
                headers: {
                  ...runtimeHeaders,
                  accept: "application/json, text/event-stream",
                  "content-type": "application/json",
                  host: "localhost",
                },
                body: JSON.stringify({
                  id: 3,
                  jsonrpc: "2.0",
                  method: "tools/call",
                  params: {
                    name: "escalation.createIssue",
                    arguments: { ticket: ticket.id },
                  },
                }),
              })
            )
          )
        )
        expect(repeated.status).toBe(200)
        const repeatedBody = yield* Effect.promise(() => repeated.text())
        const repeatedJson = repeatedBody
          .split("\n")
          .find((line) => line.startsWith("data:"))
          ?.slice(5)
          .trim()
        const repeatedPayload = Schema.decodeUnknownSync(
          Schema.Struct({
            result: Schema.Struct({
              isError: Schema.optional(Schema.Boolean),
              content: Schema.Array(
                Schema.Struct({
                  type: Schema.String,
                  text: Schema.optional(Schema.String),
                })
              ),
            }),
          })
        )(JSON.parse(repeatedJson ?? repeatedBody))
        expect(repeatedPayload.result.isError).not.toBe(true)
        expect(
          repeatedPayload.result.content.some((item) =>
            item.text?.includes(escalation.issue)
          )
        ).toBe(true)
        expect((yield* model.escalation.list({})).totalSize).toBe(1)
        expect((yield* model.issue.list({})).totalSize).toBe(1)

        const streamed = yield* model.events.stream("now").pipe(
          Effect.flatMap((stream) =>
            Stream.runCollect(stream.pipe(Stream.take(1)))
          ),
          Effect.timeout("5 seconds")
        )

        expect(streamed).toHaveLength(1)
        expect(streamed[0]?.data.reset).toBe(true)
        expect(streamed[0]?.id).toBe(streamed[0]?.data.nextCursor)

        const capabilities = yield* model.capabilities.check({
          checks: [
            { permission: "company.create", target: ROOT_ID },
            { permission: "lead.convert", target: "missing-lead" },
          ],
        })

        expect(capabilities.results).toEqual([
          { allowed: true },
          { allowed: false },
        ])

        const initial = yield* model.company.list({ pageSize: 10 })

        expect(initial).toEqual({
          items: [],
          nextPageToken: null,
          totalSize: 0,
        })

        const created = yield* model.company.create({ name: "Northstar" })

        expect(created).toMatchObject({
          lifecycleStage: "prospect",
          name: "Northstar",
        })
        const search = yield* model.records.search({
          query: "north",
          objectTypes: ["company"],
        })

        expect(search.hits).toMatchObject([
          { id: created.id, objectType: "company", title: "Northstar" },
        ])
        expect(search.hasMore).toBe(false)
        const note = yield* model.note.create({
          content: "Introductory call",
          links: { subjects: [created.id] },
        })

        expect(yield* model.note.subjects.list({ id: note.id })).toMatchObject({
          items: [{ id: created.id, objectType: "company" }],
          nextPageToken: null,
          totalSize: 1,
        })
        const contact = yield* model.contact.create({
          links: { primaryCompany: created.id },
          name: "Ada Lovelace",
        })

        expect(
          yield* makeLinkRepository(Storage, database, testPageTokens).list({
            direction: "reverse",
            linkId: "contactCompanies",
            pageSize: 10,
            sourceId: created.id,
          })
        ).toMatchObject({
          items: [{ id: contact.id, objectType: "contact" }],
          nextPageToken: null,
          totalSize: 1,
        })
        const linkedContacts = yield* model.company.contacts.list({
          id: created.id,
        })

        expect(linkedContacts.items).toMatchObject([
          { id: contact.id, objectType: "contact" },
        ])
        const secondContact = yield* model.contact.create({
          name: "Grace Hopper",
        })

        const updated = yield* model.company.update({
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

        expect(updated.name).toBe("Northstar Systems")
        expect(
          yield* model.company.contacts.list({ id: created.id })
        ).toMatchObject({
          items: [{ id: secondContact.id, objectType: "contact" }],
          nextPageToken: null,
          totalSize: 1,
        })
        expect(
          yield* Effect.flip(
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
        ).toMatchObject({ reason: "NOT_FOUND" })
        expect(yield* model.company.list({ pageSize: 10 })).toMatchObject({
          items: [expect.objectContaining({ name: "Northstar Systems" })],
        })
        yield* model.company.contacts.unlink({
          id: created.id,
          target: contact.id,
        })

        expect(
          yield* model.company.contacts.list({ id: created.id })
        ).toMatchObject({
          items: [{ id: secondContact.id, objectType: "contact" }],
          nextPageToken: null,
          totalSize: 1,
        })
        yield* model.company.contacts.link({
          id: created.id,
          target: contact.id,
        })

        yield* model.contact.primaryCompany.link({
          id: contact.id,
          target: created.id,
        })

        expect(
          yield* model.contact.primaryCompany.list({ id: contact.id })
        ).toMatchObject({
          items: [{ id: created.id, objectType: "company" }],
          nextPageToken: null,
          totalSize: 1,
        })

        yield* sql`update ${objects} set ${assignments(sql, objects, { createdAt: "2001-01-01T00:00:00.000123Z" })}
          where ${objects.columns.id} = ${contact.id}`
        yield* sql`update ${objects} set ${assignments(sql, objects, { createdAt: "2001-01-01T00:00:00.000456Z" })}
          where ${objects.columns.id} = ${secondContact.id}`
        const firstContactPage = yield* model.company.contacts.list({
          id: created.id,
          pageSize: 1,
        })

        expect(firstContactPage.items.map(({ id }) => id)).toEqual([
          secondContact.id,
        ])
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
            linkId: "contactCompanies",
            pageSize: 1,
            pageToken: nextContactPageToken,
            sourceId: ROOT_ID,
          })
          .pipe(Effect.flip)
        expect(mismatchedLinkCursor).toMatchObject({
          _tag: "InvalidLinkListRequest",
        })
        const secondContactPage = yield* model.company.contacts.list({
          id: created.id,
          pageSize: 1,
          pageToken: nextContactPageToken,
        })

        expect(secondContactPage.items.map(({ id }) => id)).toEqual([
          contact.id,
        ])
        expect(secondContactPage.nextPageToken).toBeNull()
        expect(secondContactPage.totalSize).toBe(2)
        yield* sql`update ${objects} set ${assignments(sql, objects, { createdAt: "2001-01-01T00:00:00.000123Z" })}
          where ${objects.columns.id} = ${secondContact.id}`
        const tiedFirst = yield* model.company.contacts.list({
          id: created.id,
          pageSize: 1,
        })

        const tiedIds = [contact.id, secondContact.id].sort((left, right) =>
          left < right ? 1 : left > right ? -1 : 0
        )
        expect(tiedFirst.items.map(({ id }) => id)).toEqual(tiedIds.slice(0, 1))
        const tiedToken =
          tiedFirst.nextPageToken ??
          (yield* Effect.die("Expected tied timestamp page"))
        const tiedSecond = yield* model.company.contacts.list({
          id: created.id,
          pageSize: 1,
          pageToken: tiedToken,
        })

        expect(tiedSecond.items.map(({ id }) => id)).toEqual(tiedIds.slice(1))
        expect(
          yield* makeLinkRepository(Storage, database, testPageTokens).list(
            {
              direction: "reverse",
              linkId: "contactCompanies",
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
        ).toMatchObject({
          items: [{ id: secondContact.id, objectType: "contact" }],
          nextPageToken: null,
          totalSize: 1,
        })

        const destination = yield* model.company.create({
          name: "Analytical Engine",
        })

        yield* model.company.contacts.link({
          id: destination.id,
          target: contact.id,
        })

        yield* model.company.contacts.link({
          id: destination.id,
          target: contact.id,
        })

        yield* model.contact.primaryCompany.link({
          id: contact.id,
          target: destination.id,
        })

        expect(
          yield* model.contact.primaryCompany.list({ id: contact.id })
        ).toMatchObject({
          items: [{ id: destination.id, objectType: "company" }],
          nextPageToken: null,
          totalSize: 1,
        })
        expect(
          yield* model.company.contacts.list({ id: created.id })
        ).toMatchObject({
          items: expect.arrayContaining([
            expect.objectContaining({
              id: secondContact.id,
              objectType: "contact",
            }),
            expect.objectContaining({ id: contact.id, objectType: "contact" }),
          ]),
          nextPageToken: null,
          totalSize: 2,
        })

        yield* model.company.delete({ etag: updated.etag, id: created.id })

        expect(yield* model.note.subjects.list({ id: note.id })).toEqual({
          items: [],
          nextPageToken: null,
          totalSize: 0,
        })
        const history = yield* Effect.promise(() =>
          runtime.runPromise(
            api.handle(
              new Request(
                "http://company.test/api/v1/events?type=company.deleted",
                { headers: runtimeHeaders }
              )
            )
          )
        )
        expect(history.status).toBe(200)
        expect(history.headers.get("cache-control")).toBe("private, no-store")
        const eventPage = Schema.decodeUnknownSync(eventPageSchema)(
          yield* Effect.promise(() => history.json())
        )
        expect(eventPage.items).toMatchObject([
          {
            type: "company.deleted",
            subjects: [{ id: created.id, objectType: "company" }],
          },
        ])
        const replay = yield* Effect.promise(() =>
          runtime.runPromise(
            api.handle(
              new Request(
                `http://company.test/api/v1/events?type=company.deleted&cursor=${encodeURIComponent(eventPage.nextCursor)}`,
                { headers: runtimeHeaders }
              )
            )
          )
        )
        expect(
          Schema.decodeUnknownSync(eventPageSchema)(
            yield* Effect.promise(() => replay.json())
          ).items
        ).toEqual([])
        const anonymousEvents = yield* Effect.promise(() =>
          runtime.runPromise(
            api.handle(new Request("http://company.test/api/v1/events"))
          )
        )
        expect(
          Schema.decodeUnknownSync(eventPageSchema)(
            yield* Effect.promise(() => anonymousEvents.json())
          ).items
        ).toEqual([])
        const invalidCursor = yield* Effect.promise(() =>
          runtime.runPromise(
            api.handle(
              new Request("http://company.test/api/v1/events?cursor=broken", {
                headers: runtimeHeaders,
              })
            )
          )
        )
        expect(invalidCursor.status).toBe(400)

        const secondBrowser = yield* Effect.acquireRelease(
          Effect.sync(createModelDataClient),
          (cache) => Effect.sync(() => cache.dispose())
        )
        const observed = modelQuery(
          ["company"],
          "get",
          { id: destination.id },
          (signal) =>
            runClientEffect(model.company.get({ id: destination.id }), signal)
        )
        const readCached = () =>
          Effect.promise(() => secondBrowser.queryClient.fetchQuery(observed))
        let offline = false
        const consumer = createEventConsumer({
          read: (cursor, signal) =>
            offline
              ? Promise.reject(new Error("offline"))
              : Effect.runPromise(model.events.list({ cursor }), { signal }),
          apply: (page) =>
            page.reset
              ? secondBrowser.reset()
              : secondBrowser.invalidate(
                  page.items.flatMap((event) =>
                    event.subjects.map((subject) => subject.objectType)
                  )
                ),
          isInvalidCursor: (error) => error instanceof InvalidEventCursor,
        })
        const signal = new AbortController().signal
        yield* Effect.promise(() => consumer.poll(signal))
        expect((yield* readCached()).name).toBe("Analytical Engine")
        offline = true
        yield* model.company.update({
          id: destination.id,
          name: "Changed in the first browser",
        })

        expect((yield* readCached()).name).toBe("Analytical Engine")
        yield* Effect.promise(() =>
          expect(consumer.poll(signal)).rejects.toThrow("offline")
        )
        offline = false
        yield* Effect.promise(() => consumer.poll(signal))
        expect((yield* readCached()).name).toBe("Changed in the first browser")

        const rowFields = { content: notes.columns.content }
        const [persistedNote] = yield* sql<
          SelectionRow<typeof rowFields>
        >`select ${projection(rowFields)}
          from ${notes}
          where ${notes.columns.id} = ${note.id}`
        expect(persistedNote).toEqual({ content: "Introductory call" })
        const rowFields2 = { createdById: objects.columns.createdById }
        const [auditedObject] = yield* sql<
          SelectionRow<typeof rowFields2>
        >`select ${projection(rowFields2)}
          from ${objects}
          where ${objects.columns.id} = ${destination.id}`
        expect(auditedObject?.createdById).toBe("us_test")
        const rowFields3 = { id: users.columns.id, name: users.columns.name }
        const [projectedUser] = yield* sql<
          SelectionRow<typeof rowFields3>
        >`select ${projection(rowFields3)}
          from ${users}
          where ${users.columns.id} = ${"us_test"}`
        expect(projectedUser).toEqual({ id: "us_test", name: "Owner" })
        const rowFields4 = { identityId: identityBindings.columns.identityId }
        const [binding] = yield* sql<
          SelectionRow<typeof rowFields4>
        >`select ${projection(rowFields4)}
          from ${identityBindings}
          where ${identityBindings.columns.subject} = ${"us_test"}`
        expect(binding).toEqual({ identityId: "us_test" })
        const rowFields5 = {
          principalId: roleAssignments.columns.principalId,
          roleId: roleAssignments.columns.roleId,
        }
        const [assignment] = yield* sql<
          SelectionRow<typeof rowFields5>
        >`select ${projection(rowFields5)}
          from ${roleAssignments}
          where ${roleAssignments.columns.principalId} = ${"us_test"}`
        expect(assignment).toEqual({
          principalId: "us_test",
          roleId: ADMINISTRATOR_ROLE_ID,
        })
      }),
    10_000
  )
})
