import { Effect, Exit } from "effect"
import { expect } from "vitest"

import {
  defineObject,
  defineLink,
  defineModule,
  defineModel,
  RecordAlias,
  schema,
} from "#/runtime/model/index.ts"
import { PlatformModule } from "#/runtime/platform/model/index.ts"
import { Database } from "#/runtime/server/database.ts"
import { EventJournal } from "#/runtime/server/events/event-journal.ts"
import { runOperation } from "#/runtime/server/operation-mode.ts"
import { testFoundation } from "#/runtime/testing/foundation.ts"

const Group = defineObject({
  id: "upsertGroup",
  collection: "upsertGroups",
  name: "Group",
  pluralName: "Groups",
  properties: { name: schema.string() },
  display: { title: "name" },
})
const Item = defineObject({
  id: "upsertItem",
  collection: "upsertItems",
  name: "Item",
  pluralName: "Items",
  properties: {
    name: schema.string(),
    description: schema.string({ nullable: true }),
    revision: schema.number({ outputOnly: true, nullable: true }),
  },
  display: { title: "name" },
})
const Membership = defineLink({
  id: "upsertMembership",
  outputOnly: true,
  from: { type: Item, key: "group", min: 1, max: 1 },
  to: { type: Group, key: "items" },
})
const model = defineModel({
  name: "Upsert test",
  modules: [
    PlatformModule,
    defineModule({
      id: "upsert",
      name: "Upsert",
      objects: [Group, Item],
      links: [Membership],
    }),
  ],
})
const fixture = testFoundation(model)

fixture.test(
  "upserts concurrently by alias, preserves identity and other aliases, and journals only changes",
  () =>
    Effect.gen(function* () {
      const database = yield* Database
      const journal = yield* EventJournal
      const items = database.repository(Item)
      const groups = database.repository(Group)
      const group = yield* groups.create({ name: "First" })
      const alias = RecordAlias("system:item:example")
      const input = {
        alias,
        values: { name: "Example", revision: 1 },
        links: { group: group.id },
      }
      const records = yield* Effect.all(
        Array.from({ length: 8 }, () => items.upsert(input)),
        { concurrency: "unbounded" }
      )
      const first = records[0]!
      expect(new Set(records.map((record) => record.id)).size).toBe(1)
      expect(first.id).toMatch(/^upsert_item_[0-9a-z]{26}$/)
      expect(
        (yield* journal.list({ type: "upsertItem.created" })).items
      ).toHaveLength(1)
      expect(
        (yield* journal.list({ type: "upsertItem.updated" })).items
      ).toHaveLength(0)
      const alternate = RecordAlias("external:item:123")
      const edited = yield* items.update({
        id: first.id,
        description: "Keep this",
        aliases: { add: [alternate] },
      })
      const before = yield* journal.list({ cursor: "now" })
      const unchanged = yield* items.upsert(input)
      expect(unchanged.etag).toBe(edited.etag)
      expect(unchanged.updatedAt).toBe(edited.updatedAt)
      expect(
        (yield* journal.list({ cursor: before.nextCursor })).items
      ).toEqual([])
      const nextGroup = yield* groups.create({ name: "Second" })
      const changed = yield* items.upsert({
        ...input,
        values: { name: "Updated", revision: 2 },
        links: { group: nextGroup.id },
      })
      expect(changed).toMatchObject({
        id: first.id,
        name: "Updated",
        revision: 2,
        description: "Keep this",
      })
      expect(changed.aliases).toEqual(
        expect.arrayContaining([alias, alternate])
      )
      const membership = yield* items.list({
        filter: {
          link: "group",
          some: { field: "id", operator: "eq", value: nextGroup.id },
        },
      })
      expect(membership.items.map((record) => record.id)).toEqual([first.id])
      const wrongType = yield* groups
        .upsert({ alias, values: { name: "Wrong" } })
        .pipe(Effect.exit)
      expect(Exit.isFailure(wrongType)).toBe(true)
      expect((yield* items.get({ id: alias })).id).toBe(first.id)
      const readOnly = yield* runOperation(
        database,
        "query",
        items.upsert(input)
      ).pipe(Effect.exit)
      expect(Exit.isFailure(readOnly)).toBe(true)
    })
)

fixture.test("rolls back a failed alias upsert with its record and links", () =>
  Effect.gen(function* () {
    const database = yield* Database
    const items = database.repository(Item)
    const alias = RecordAlias("system:item:retry")
    expect(
      Exit.isFailure(
        yield* items
          .upsert({ alias, values: { name: "Missing group" } })
          .pipe(Effect.exit)
      )
    ).toBe(true)
    expect((yield* items.list({})).items).toHaveLength(0)
    const group = yield* database.repository(Group).create({ name: "Ready" })
    const created = yield* items.upsert({
      alias,
      values: { name: "Recovered" },
      links: { group: group.id },
    })
    expect((yield* items.get({ id: alias })).id).toBe(created.id)
  })
)
