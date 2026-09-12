import { Effect, Layer } from "effect"
import { HttpRouter, HttpServer } from "effect/unstable/http"
import { OpenApi, HttpApiBuilder } from "effect/unstable/httpapi"
import { expect, expectTypeOf, it } from "vitest"

import { createEffectClient } from "#/runtime/client/create-client.ts"
import { createModelQueries } from "#/runtime/client/model-query-client.ts"
import {
  createModelHttpApi,
  HttpValidationMiddleware,
} from "#/runtime/contract/http-api.ts"
import { modelOperation } from "#/runtime/contract/operations.ts"
import { moduleDependencies } from "#/runtime/model/definition/validate-model.ts"
import {
  defineAction,
  defineQuery,
  defineObject,
  defineModule,
  defineModel,
  enableModules,
  RecordAlias,
  schema,
} from "#/runtime/model/index.ts"
import { createModelHttpHandlers } from "#/runtime/server/http.ts"
import { systemInvocation } from "#/runtime/server/invocation-context.ts"
import { CurrentInvocation } from "#/runtime/server/invocation.ts"
import { implementModel } from "#/runtime/server/model-implementation.ts"

const Ticket = defineObject({
  id: "ticket",
  collection: "tickets",
  name: "Ticket",
  pluralName: "Tickets",
  properties: { name: schema.string() },
  display: { title: "name" },
})
const Tickets = defineModule({
  id: "support",
  name: "Support",
  objects: [Ticket],
})
const Escalate = defineAction({
  id: "escalate",
  object: Ticket,
  name: "Escalate",
  description: "Escalate a ticket.",
  input: { id: schema.id(Ticket), reason: schema.string() },
  output: { accepted: schema.boolean() },
})
const Summary = defineQuery({
  id: "summary",
  collection: Ticket,
  name: "Summary",
  description: "Summarize tickets.",
  input: { statuses: schema.array(schema.string()) },
  output: { count: schema.number() },
})
const Reconcile = defineAction({
  id: "reconcile",
  name: "Reconcile",
  description: "Reconcile all systems.",
  input: { dryRun: schema.boolean() },
  output: { accepted: schema.boolean() },
})
const Health = defineQuery({
  id: "health",
  name: "Health",
  description: "Read application health.",
  output: { count: schema.number() },
})
const Extension = defineModule({
  id: "extension",
  name: "Extension",
  objects: [],
  actions: [Escalate, Reconcile],
  queries: [Summary, Health],
})
const model = defineModel({ name: "Test", modules: [Tickets, Extension] })

it("owns operations independently of attachment and removes them with their module", () => {
  expect(moduleDependencies(Extension, [Tickets, Extension])).toEqual([
    expect.objectContaining({ moduleId: "support" }),
  ])
  expect(modelOperation(model, "ticket.escalate")).toMatchObject({
    moduleId: "extension",
    scope: "object",
    object: model.objects.ticket,
  })
  const active = enableModules(model, ["support"])
  expect(active.objects.ticket).toBeDefined()
  expect(active.actions).not.toHaveProperty("ticket.escalate")
  expect(() => enableModules(model, ["extension"])).toThrow(/depends on/)
})

it("uses noun-based colon routes, typed clients and shared cache options for all attachments", async () => {
  const document = OpenApi.fromApi(createModelHttpApi(model))
  for (const [path, operationId] of [
    ["/api/v1/tickets/{id}:escalate", "escalateTicket"],
    ["/api/v1/tickets:summary", "summaryTickets"],
    ["/api/v1/:reconcile", "reconcile"],
    ["/api/v1/:health", "health"],
  ]) {
    expect(document.paths[path!]?.post?.operationId).toBe(operationId)
  }
  const requests: { path: string; method: string; input: unknown }[] = []
  const client = createEffectClient(model, {
    baseUrl: "http://company.test",
    fetch: async (input, init) => {
      const request = new Request(input, init)
      const body = await request.text()
      requests.push({
        path: new URL(request.url).pathname,
        method: request.method,
        input: body ? JSON.parse(body) : {},
      })
      return Response.json(
        request.url.includes("summary") || request.url.includes("health")
          ? { count: 2 }
          : { accepted: true }
      )
    },
  })
  expect(
    await Effect.runPromise(
      client.ticket.escalate({
        id: RecordAlias("external:ticket"),
        reason: "urgent",
      })
    )
  ).toEqual({ accepted: true })
  await Effect.runPromise(client.ticket.summary({ statuses: ["open"] }))
  await Effect.runPromise(client.reconcile({ dryRun: true }))
  const data = createModelQueries(model, client)
  expect(
    await data.health({}).queryFn({ signal: new AbortController().signal })
  ).toEqual({ count: 2 })
  expectTypeOf<Parameters<typeof client.reconcile>[0]>().toEqualTypeOf<{
    readonly dryRun: boolean
  }>()
  expect(requests).toEqual([
    {
      path: "/api/v1/tickets/external%3Aticket:escalate",
      method: "POST",
      input: { reason: "urgent" },
    },
    {
      path: "/api/v1/tickets:summary",
      method: "POST",
      input: { statuses: ["open"] },
    },
    { path: "/api/v1/:reconcile", method: "POST", input: { dryRun: true } },
    { path: "/api/v1/:health", method: "POST", input: {} },
  ])
})

it("rejects ambiguous attachment and missing, optional, or wrongly typed record IDs", () => {
  const base = { id: "bad", name: "Bad", description: "Invalid contract." }
  // @ts-expect-error A record action requires an explicit id input.
  expect(() => defineAction({ ...base, object: Ticket })).toThrow(/input.id/)
  expect(() =>
    // @ts-expect-error Attachment is exclusive.
    defineAction({
      ...base,
      object: Ticket,
      collection: Ticket,
      input: { id: schema.id(Ticket) },
    })
  ).toThrow(/both/)
  expect(() =>
    // @ts-expect-error Plain strings do not declare a typed record identifier.
    defineAction({ ...base, object: Ticket, input: { id: schema.string() } })
  ).toThrow(/input.id/)
  expect(() =>
    defineAction({
      ...base,
      object: Ticket,
      // @ts-expect-error Optional IDs cannot locate the record.
      input: { id: schema.optional(schema.id(Ticket)) },
    })
  ).toThrow(/input.id/)
  expect(() =>
    defineModel({
      name: "Collision",
      modules: [
        Tickets,
        defineModule({
          id: "bad",
          name: "Bad",
          objects: [],
          actions: [defineAction({ ...base, id: "ticket" })],
        }),
      ],
    })
  ).toThrow(/namespace/)
  expect(() => defineModel({ name: "Missing", modules: [Extension] })).toThrow(
    /not registered/
  )
})

it("binds global-only models to real HTTP handlers", async () => {
  const globalModel = defineModel({
    name: "Global",
    modules: [
      defineModule({
        id: "globalOperations",
        name: "Global operations",
        objects: [],
        actions: [Reconcile],
        queries: [Health],
      }),
    ],
  })
  const api = createModelHttpApi(globalModel)
  const implementation = implementModel(
    globalModel,
    {
      reconcile: ({ dryRun }: { readonly dryRun: boolean }) =>
        Effect.succeed({ accepted: dryRun }),
      health: () => Effect.succeed({ count: 5 }),
    },
    {
      list: () => Effect.die("unused"),
      link: () => Effect.die("unused"),
      unlink: () => Effect.die("unused"),
    }
  )
  const groups = createModelHttpHandlers(
    api,
    implementation,
    (_request, _descriptor, operation) =>
      operation.pipe(Effect.provideService(CurrentInvocation, systemInvocation))
  )
  const handler = HttpRouter.toWebHandler(
    HttpApiBuilder.layer(api).pipe(
      Layer.provide(groups),
      Layer.provide(HttpValidationMiddleware.layer),
      Layer.provide(HttpServer.layerServices)
    ),
    { disableLogger: true }
  )
  try {
    const response = await handler.handler(
      new Request("http://company.test/api/v1/:reconcile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dryRun: true }),
      })
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ accepted: true })
    const health = await handler.handler(
      new Request("http://company.test/api/v1/:health", { method: "POST" })
    )
    expect(health.status).toBe(200)
    expect(await health.json()).toEqual({ count: 5 })
  } finally {
    await handler.dispose()
  }
})

it("rejects public OpenAPI identifier collisions without adding module prefixes", () => {
  const collision = defineAction({
    id: "escalateTicket",
    name: "Collision",
    description: "Collides with the attached operation.",
  })
  const conflicts = defineModel({
    name: "Conflicts",
    modules: [
      Tickets,
      Extension,
      defineModule({
        id: "other",
        name: "Other",
        objects: [],
        actions: [collision],
      }),
    ],
  })
  expect(() => createModelHttpApi(conflicts)).toThrow(
    /duplicate OpenAPI operationId/
  )
})
