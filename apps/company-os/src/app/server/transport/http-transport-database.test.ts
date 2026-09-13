import { PgClient } from "@effect/sql-pg"
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
import { createChangeConsumer } from "#/app/client/change-consumer.ts"
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
import { createModelDataClient } from "#/runtime/client/model-cache.ts"
import { modelQuery } from "#/runtime/client/model-query-client.ts"
import {
  eventPageSchema,
  InvalidEventCursor,
} from "#/runtime/contract/events.ts"
import { httpOperation } from "#/runtime/contract/http-operation.ts"
import { operationContracts } from "#/runtime/contract/operation-contract.ts"
import { RecordAlias } from "#/runtime/model/index.ts"
import { makeApplicationKeys } from "#/runtime/server/application-keys.ts"
import {
  makeEncryptedPageTokenCodec,
  PageTokens,
} from "#/runtime/server/page-tokens.ts"
import {
  assignments,
  projection,
  type SelectionRow,
} from "#/runtime/server/storage/index.ts"
import { identityBindings } from "#/runtime/server/storage/infrastructure.ts"
import { SqlDatabase } from "#/runtime/server/storage/transactions.ts"

const application = testApplication()
const { objects } = Storage.core
const { note: notes, user: users } = Storage.objects

const testPageTokens = makeEncryptedPageTokenCodec(
  makeApplicationKeys(
    "http-transport-test-application-secret-at-least-32-bytes"
  ).deriveKey("http-transport-page-token-test:v1")
)

const runtimeHeaders = {
  "x-continual-app-runtime-assertion": "runtime-assertion",
  "x-continual-app-runtime-origin": "https://continual.example",
}

const modelProjectionContract = operationContracts(Model).map((descriptor) => ({
  httpOperationId: httpOperation(descriptor).identifier,
  mcpToolName: descriptor.key,
}))

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
              kind: "user",
              projectId: "project_test",
              projectAccess: true,
              email: "owner@example.com",
              name: "Owner",
            })
          )
        )
        const database = yield* SqlDatabase
        const sql = database.sql

        const runtime = yield* Effect.acquireRelease(
          Effect.sync(() =>
            ManagedRuntime.make(
              makeApplicationLayer({
                sql: Layer.succeed(PgClient.PgClient, database.sql),
                pageTokens: Layer.succeed(PageTokens, testPageTokens),
              }).pipe(
                Layer.provide(
                  ConfigProvider.layer(
                    ConfigProvider.fromEnvRecord({
                      CONTINUAL_URL: "https://continual.example",
                      CONTINUAL_PROJECT_ID: "project_test",
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
                  "x-continual-app-runtime-assertion": "member",
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
        expect(mcpToolNames.has("records.batchGet")).toBe(true)
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
        const invalidAccount = yield* Effect.promise(() =>
          runtime.runPromise(
            api.handle(
              new Request("http://company.test/api/v1/accounts", {
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
        expect(invalidAccount.status).toBe(400)
        expect(
          yield* Effect.promise(() => invalidAccount.json())
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

        const callMcp = (
          name: string,
          args: Readonly<Record<string, unknown>>
        ) =>
          Effect.promise(async () => {
            const response = await runtime.runPromise(
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
                    id: 10,
                    jsonrpc: "2.0",
                    method: "tools/call",
                    params: { name, arguments: args },
                  }),
                })
              )
            )
            expect(response.status).toBe(200)
            const body = await response.text()
            const data =
              body
                .split("\n")
                .find((line) => line.startsWith("data:"))
                ?.slice(5)
                .trim() ?? body
            return Schema.decodeUnknownSync(
              Schema.Struct({
                result: Schema.Struct({
                  isError: Schema.optionalKey(Schema.Boolean),
                  structuredContent: Schema.optionalKey(
                    Schema.Record(Schema.String, Schema.Unknown)
                  ),
                }),
              })
            )(JSON.parse(data)).result
          })

        const ticket = yield* model.ticket.create({
          subject: "HTTP to MCP customer report",
        })

        const issue = yield* model.issue.create({
          title: ticket.subject,
          links: { tickets: [ticket.id] },
        })

        const expandedTicket = yield* model.ticket.get({
          id: ticket.id,
          expand: true,
        })
        expect(
          expandedTicket.links.issues.items.map((item) => item.id)
        ).toContain(issue.id)
        const mcpExpanded = yield* callMcp("ticket.get", {
          id: ticket.id,
          expand: true,
        })
        expect(mcpExpanded.isError).not.toBe(true)
        expect(mcpExpanded.structuredContent).toEqual(expandedTicket)

        const hydrated = yield* model.records.batchGet({
          ids: [ticket.id, issue.id, "missing"],
        })
        expect(hydrated.items.map((item) => item.objectType)).toEqual([
          "ticket",
          "issue",
        ])
        expect(hydrated.missingIds).toEqual(["missing"])
        const mcpHydrated = yield* Effect.promise(() =>
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
                  id: 30,
                  jsonrpc: "2.0",
                  method: "tools/call",
                  params: {
                    name: "records.batchGet",
                    arguments: {
                      ids: [ticket.id, issue.id, "missing"],
                    },
                  },
                }),
              })
            )
          )
        )
        const hydratedText = yield* Effect.promise(() => mcpHydrated.text())
        const hydratedPayload = Schema.decodeUnknownSync(
          Schema.Struct({
            result: Schema.Struct({
              structuredContent: Schema.Struct({
                items: Schema.Array(
                  Schema.Struct({ objectType: Schema.String })
                ),
                missingIds: Schema.Array(Schema.String),
              }),
            }),
          })
        )(
          JSON.parse(
            hydratedText
              .split("\n")
              .find((line) => line.startsWith("data:"))
              ?.slice(5)
              .trim() ?? hydratedText
          )
        )
        expect(
          hydratedPayload.result.structuredContent.items.map(
            (item) => item.objectType
          )
        ).toEqual(["ticket", "issue"])
        expect(hydratedPayload.result.structuredContent.missingIds).toEqual([
          "missing",
        ])

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
                    name: "issue.get",
                    arguments: { id: issue.id },
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
            item.text?.includes(issue.id)
          )
        ).toBe(true)
        expect((yield* model.issue.list({})).totalSize).toBe(1)

        const streamed = yield* model.changes.stream("now").pipe(
          Effect.flatMap((stream) =>
            Stream.runCollect(stream.pipe(Stream.take(1)))
          ),
          Effect.timeout("5 seconds")
        )

        expect(streamed).toHaveLength(1)
        expect(streamed[0]?.data.reset).toBe(true)
        expect(streamed[0]?.id).toBe(streamed[0]?.data.nextCursor)

        const initial = yield* model.account.list({ pageSize: 10 })

        expect(initial).toEqual({
          items: [],
          nextPageToken: null,
          totalSize: 0,
        })

        const created = yield* model.account.create({ name: "Northstar" })

        expect(created).toMatchObject({
          lifecycleStage: "prospect",
          name: "Northstar",
        })
        // MCP writes and HTTP reads must agree on canonical inputs, records, and Links.
        expect(
          yield* Effect.flip(
            model.activity.create({
              title: "Missing link target",
              links: { accounts: [RecordAlias("test:contract:missing")] },
            })
          )
        ).toMatchObject({ reason: "NOT_FOUND" })
        const contractAlias = RecordAlias("test:contract:activity")
        expect(
          yield* callMcp("activity.create", {
            title: "Contract activity",
            aliases: [contractAlias],
            links: { accounts: [created.id] },
          })
        ).toMatchObject({
          structuredContent: {
            title: "Contract activity",
            objectType: "activity",
          },
        })
        expect(
          yield* model.activity.accounts.list({ id: contractAlias })
        ).toMatchObject({ items: [{ id: created.id }], totalSize: 1 })
        expect(
          yield* callMcp("activity.update", {
            id: contractAlias,
            title: "Updated contract activity",
            links: { accounts: { remove: [created.id] } },
          })
        ).toMatchObject({
          structuredContent: { title: "Updated contract activity" },
        })
        expect(yield* model.activity.get({ id: contractAlias })).toMatchObject({
          title: "Updated contract activity",
        })
        expect(
          yield* model.activity.accounts.list({ id: contractAlias })
        ).toMatchObject({ items: [], totalSize: 0 })
        expect(
          yield* callMcp("activity.list", {
            filter: {
              field: "title",
              operator: "eq",
              value: "Updated contract activity",
            },
          })
        ).toMatchObject({
          structuredContent: {
            items: [{ title: "Updated contract activity" }],
            totalSize: 1,
          },
        })
        expect(
          yield* callMcp("activity.batchDelete", {
            ids: Array.from({ length: 101 }, () => contractAlias),
          })
        ).toMatchObject({ isError: true })
        expect(
          yield* callMcp("activity.delete", { id: contractAlias })
        ).toMatchObject({ structuredContent: {} })
        expect(
          yield* Effect.flip(model.activity.get({ id: contractAlias }))
        ).toMatchObject({ reason: "NOT_FOUND" })

        const search = yield* model.records.search({
          query: "north",
          objectTypes: ["account"],
        })

        expect(search.hits).toMatchObject([
          { id: created.id, objectType: "account", title: "Northstar" },
        ])
        expect(search.hasMore).toBe(false)
        const note = yield* model.note.create({
          content: "Introductory call",
          links: { subjects: [created.id] },
        })

        expect(yield* model.note.subjects.list({ id: note.id })).toMatchObject({
          items: [{ id: created.id, objectType: "account" }],
          nextPageToken: null,
          totalSize: 1,
        })
        const activity = yield* model.activity.create({
          links: { accounts: [created.id] },
          title: "Discovery meeting",
        })

        const linkedActivities = yield* model.account.activities.list({
          id: created.id,
        })

        expect(linkedActivities.items).toMatchObject([
          { id: activity.id, objectType: "activity" },
        ])
        const secondActivity = yield* model.activity.create({
          title: "Technical review",
        })

        const updated = yield* model.account.update({
          etag: (yield* model.account.get({ id: created.id })).etag,
          id: created.id,
          links: {
            activities: {
              add: [secondActivity.id],
              remove: [activity.id],
            },
          },
          name: "Northstar Systems",
        })

        expect(updated.name).toBe("Northstar Systems")
        expect(
          yield* model.account.activities.list({ id: created.id })
        ).toMatchObject({
          items: [{ id: secondActivity.id, objectType: "activity" }],
          nextPageToken: null,
          totalSize: 1,
        })
        expect(
          yield* Effect.flip(
            model.account.update({
              etag: updated.etag,
              id: created.id,
              links: {
                activities: {
                  add: [RecordAlias("test:activity:missing")],
                },
              },
              name: "This must roll back",
            })
          )
        ).toMatchObject({ reason: "NOT_FOUND" })
        expect(yield* model.account.list({ pageSize: 10 })).toMatchObject({
          items: [expect.objectContaining({ name: "Northstar Systems" })],
        })
        yield* model.account.activities.unlink({
          id: created.id,
          target: activity.id,
        })

        expect(
          yield* model.account.activities.list({ id: created.id })
        ).toMatchObject({
          items: [{ id: secondActivity.id, objectType: "activity" }],
          nextPageToken: null,
          totalSize: 1,
        })
        yield* model.account.activities.link({
          id: created.id,
          target: activity.id,
        })

        yield* model.activity.accounts.link({
          id: activity.id,
          target: created.id,
        })

        expect(
          yield* model.activity.accounts.list({ id: activity.id })
        ).toMatchObject({
          items: [{ id: created.id, objectType: "account" }],
          nextPageToken: null,
          totalSize: 1,
        })

        yield* sql`update ${objects} set ${assignments(sql, objects, { createdAt: "2001-01-01T00:00:00.000123Z" })}
          where ${objects.columns.id} = ${activity.id}`
        yield* sql`update ${objects} set ${assignments(sql, objects, { createdAt: "2001-01-01T00:00:00.000456Z" })}
          where ${objects.columns.id} = ${secondActivity.id}`
        const firstActivityPage = yield* model.account.activities.list({
          id: created.id,
          pageSize: 1,
        })

        expect(firstActivityPage.items.map(({ id }) => id)).toEqual([
          secondActivity.id,
        ])
        expect(firstActivityPage.nextPageToken).not.toBeNull()
        expect(firstActivityPage.totalSize).toBe(2)
        const nextActivityPageToken =
          firstActivityPage.nextPageToken === null
            ? yield* Effect.die("Expected another activity page")
            : firstActivityPage.nextPageToken
        expect(nextActivityPageToken.length).toBeLessThan(256)
        const otherAccount = yield* model.account.create({
          name: "Other account",
        })
        const mismatchedLinkCursor = yield* model.account.activities
          .list({
            id: otherAccount.id,
            pageSize: 1,
            pageToken: nextActivityPageToken,
          })
          .pipe(Effect.flip)
        expect(mismatchedLinkCursor).toMatchObject({
          status: "INVALID_ARGUMENT",
        })
        const secondActivityPage = yield* model.account.activities.list({
          id: created.id,
          pageSize: 1,
          pageToken: nextActivityPageToken,
        })

        expect(secondActivityPage.items.map(({ id }) => id)).toEqual([
          activity.id,
        ])
        expect(secondActivityPage.nextPageToken).toBeNull()
        expect(secondActivityPage.totalSize).toBe(2)
        yield* sql`update ${objects} set ${assignments(sql, objects, { createdAt: "2001-01-01T00:00:00.000123Z" })}
          where ${objects.columns.id} = ${secondActivity.id}`
        const tiedFirst = yield* model.account.activities.list({
          id: created.id,
          pageSize: 1,
        })

        const tiedIds = [activity.id, secondActivity.id].sort((left, right) =>
          left < right ? 1 : left > right ? -1 : 0
        )
        expect(tiedFirst.items.map(({ id }) => id)).toEqual(tiedIds.slice(0, 1))
        const tiedToken =
          tiedFirst.nextPageToken ??
          (yield* Effect.die("Expected tied timestamp page"))
        const tiedSecond = yield* model.account.activities.list({
          id: created.id,
          pageSize: 1,
          pageToken: tiedToken,
        })

        expect(tiedSecond.items.map(({ id }) => id)).toEqual(tiedIds.slice(1))
        const destination = yield* model.account.create({
          name: "Analytical Engine",
        })

        yield* model.account.activities.link({
          id: destination.id,
          target: activity.id,
        })

        yield* model.account.activities.link({
          id: destination.id,
          target: activity.id,
        })

        yield* model.activity.update({
          id: activity.id,
          links: { accounts: [destination.id] },
        })

        expect(
          yield* model.activity.accounts.list({ id: activity.id })
        ).toMatchObject({
          items: [{ id: destination.id, objectType: "account" }],
          nextPageToken: null,
          totalSize: 1,
        })
        expect(
          yield* model.account.activities.list({ id: created.id })
        ).toMatchObject({
          items: expect.arrayContaining([
            expect.objectContaining({
              id: secondActivity.id,
              objectType: "activity",
            }),
          ]),
          nextPageToken: null,
          totalSize: 1,
        })

        yield* model.account.delete({
          etag: (yield* model.account.get({ id: created.id })).etag,
          id: created.id,
        })

        expect(yield* model.note.subjects.list({ id: note.id })).toEqual({
          items: [],
          nextPageToken: null,
          totalSize: 0,
        })
        const history = yield* Effect.promise(() =>
          runtime.runPromise(
            api.handle(
              new Request(
                "http://company.test/api/v1/events?type=account.deleted",
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
            type: "account.deleted",
            subjects: [{ id: created.id, objectType: "account" }],
          },
        ])
        const replay = yield* Effect.promise(() =>
          runtime.runPromise(
            api.handle(
              new Request(
                `http://company.test/api/v1/events?type=account.deleted&cursor=${encodeURIComponent(eventPage.nextCursor)}`,
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
        expect(anonymousEvents.status).toBe(401)

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
          ["account"],
          "get",
          { id: destination.id },
          (signal) =>
            runClientEffect(model.account.get({ id: destination.id }), signal)
        )
        const readCached = () =>
          Effect.promise(() => secondBrowser.queryClient.fetchQuery(observed))
        let offline = false
        const consumer = createChangeConsumer({
          read: (cursor, signal) =>
            offline
              ? Promise.reject(new Error("offline"))
              : Effect.runPromise(model.changes.list({ cursor }), { signal }),
          apply: (page) =>
            page.reset
              ? secondBrowser.reset()
              : secondBrowser.invalidate(page.changedTypes),
          isInvalidCursor: (error) => error instanceof InvalidEventCursor,
        })
        const signal = new AbortController().signal
        yield* Effect.promise(() => consumer.poll(signal))
        expect((yield* readCached()).name).toBe("Analytical Engine")
        const changesHead = yield* model.changes.list({ cursor: "now" })
        offline = true
        yield* model.account.update({
          id: destination.id,
          name: "Changed in the first browser",
        })

        const changes = yield* model.changes.list({
          cursor: changesHead.nextCursor,
        })
        expect(changes.changedTypes).toContain("account")
        expect(Object.keys(changes).sort()).toEqual([
          "changedTypes",
          "hasMore",
          "nextCursor",
          "reset",
        ])
        const changesResponse = yield* Effect.promise(() =>
          runtime.runPromise(
            api.handle(
              new Request("http://company.test/api/v1/changes?cursor=now", {
                headers: runtimeHeaders,
              })
            )
          )
        )
        expect(changesResponse.headers.get("cache-control")).toBe(
          "private, no-store"
        )
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
      }),
    10_000
  )
})
