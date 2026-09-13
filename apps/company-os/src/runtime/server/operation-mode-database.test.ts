import { Effect, Exit } from "effect"
import { expect } from "vitest"

import {
  defineAction,
  defineEvent,
  defineLink,
  defineModel,
  defineModule,
  defineObject,
  defineQuery,
  schema,
  type QueryInput,
} from "#/runtime/model/index.ts"
import { PlatformModule } from "#/runtime/platform/model/index.ts"
import {
  Database,
  EventJournal,
  defineModuleServer,
} from "#/runtime/server/index.ts"
import { operationsFor } from "#/runtime/server/operation-executor.ts"
import { runOperation } from "#/runtime/server/operation-mode.ts"
import { testFoundation } from "#/runtime/testing/foundation.ts"

const Item = defineObject({
  id: "item",
  collection: "items",
  name: "Item",
  pluralName: "Items",
  properties: { name: schema.string() },
  display: { title: "name" },
})
const Related = defineLink({
  id: "related",
  name: "Related",
  from: { type: Item, key: "related", label: "Related" },
  to: { type: Item, key: "relatedTo", label: "Related to" },
})
const Fact = defineEvent({
  type: "item.checked",
  version: 1,
  subject: Item,
  data: schema.object({}),
})
const Items = defineModule({
  id: "items",
  name: "Items",
  objects: [Item],
  links: [Related],
  events: [Fact],
})
const Create = defineAction({
  id: "makeItem",
  name: "Make item",
  description: "Creates an item.",
  input: { name: schema.string() },
  output: { id: schema.id(Item) },
})
const Probe = defineQuery({
  id: "probe",
  object: Item,
  name: "Probe",
  description: "Tests the read boundary.",
  input: {
    id: schema.id(Item),
    mode: schema.select({
      options: ["read", "record", "link", "event", "action", "sql"].map(
        (value) => ({ value, label: value })
      ),
    }),
  },
  output: { count: schema.number() },
})
const Extension = defineModule({
  id: "extension",
  name: "Extension",
  objects: [],
  actions: [Create],
  queries: [Probe],
})
const makeItem = Effect.fn(function* ({ name }: { readonly name: string }) {
  const row = yield* (yield* Database).repository(Item).create({ name })
  return { id: row.id }
})
const model = defineModel({
  name: "Read boundary",
  modules: [PlatformModule, Items, Extension],
})
const probe = Effect.fn(function* (input: QueryInput<typeof Probe>) {
  const records = yield* Database
  const row = yield* records.repository(Item).get({ id: input.id })
  switch (input.mode) {
    case "record":
      yield* records.repository(Item).update({ id: row.id, name: "forbidden" })
      break
    case "link":
      yield* records
        .repository(Item)
        .update({ id: row.id, links: { related: { add: [row.id] } } })
      break
    case "event":
      yield* (yield* EventJournal).append(Fact, { subject: row.id, data: {} })
      break
    case "action":
      yield* runOperation(
        yield* Database,
        "action",
        makeItem({ name: "forbidden" })
      )
      break
    case "sql":
      yield* (yield* Database).sql`update items set name = 'forbidden'`
      break
    case "read":
      break
  }
  return { count: 1 }
})
const server = defineModuleServer(Extension, { makeItem, item: { probe } })
const fixture = testFoundation(model, { servers: [server] })
fixture.test(
  "read-only Queries reject trusted writes, nested Actions, events and raw SQL while Actions remain atomic",
  () =>
    Effect.gen(function* () {
      const services = yield* operationsFor(model)
      const { id } = yield* services.makeItem({ name: "original" })
      expect(yield* services.item.probe({ id, mode: "read" })).toEqual({
        count: 1,
      })
      for (const mode of [
        "record",
        "link",
        "event",
        "action",
        "sql",
      ] as const) {
        expect(
          Exit.isFailure(yield* Effect.exit(services.item.probe({ id, mode })))
        ).toBe(true)
        expect((yield* services.item.get({ id })).name).toBe("original")
      }
      const database = yield* Database
      // Queries cannot inherit a writable transaction, even for a direct SQL implementation.
      yield* database.transaction(() =>
        Effect.gen(function* () {
          expect(
            Exit.isFailure(
              yield* Effect.exit(services.item.probe({ id, mode: "sql" }))
            )
          ).toBe(true)
        })
      )
      expect((yield* services.item.list({})).totalSize).toBe(1)
      expect(
        (yield* database.sql`select count(*)::int as n from event_journal where type = 'item.checked'`)[0]
          ?.n
      ).toBe(0)
    })
)
