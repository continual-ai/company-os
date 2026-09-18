import { Effect, type Schema } from "effect"
import { expect } from "vitest"

import {
  defineModel,
  defineModule,
  defineObject,
  schema,
} from "#/runtime/model/index.ts"
import { PlatformModule } from "#/runtime/platform/model/index.ts"
import { Database } from "#/runtime/server/database.ts"
import { EventJournal } from "#/runtime/server/events/event-journal.ts"
import { testFoundation } from "#/runtime/testing/foundation.ts"

const Payload = defineObject({
  id: "jsonPayload",
  collection: "jsonPayloads",
  name: "JSON payload",
  pluralName: "JSON payloads",
  properties: {
    name: schema.string(),
    payload: schema.json(),
    defaultNull: schema.json({ default: null }),
    optionalPayload: schema.json({ nullable: true }),
    call: schema.object({ name: schema.string(), arguments: schema.json() }),
  },
  display: { title: "name" },
})
const fixture = testFoundation(
  defineModel({
    name: "JSON test",
    modules: [
      PlatformModule,
      defineModule({ id: "jsonTest", name: "JSON test", objects: [Payload] }),
    ],
  })
)

fixture.test(
  "round trips JSON primitives and nested payloads through records and journal snapshots",
  () =>
    Effect.gen(function* () {
      const database = yield* Database
      const records = database.repository(Payload)
      const journal = yield* EventJournal
      const values: ReadonlyArray<Schema.Json> = [
        null,
        "",
        "null",
        0,
        false,
        [],
        {},
        { nested_key: [null, { enabled: true, parameters: [1, "value"] }] },
      ]
      for (const [index, value] of values.entries()) {
        const call = { name: "lookup", arguments: value }
        const created = yield* records.create({
          name: String(index),
          payload: value,
          call,
        })
        expect(created).toMatchObject({
          payload: value,
          call,
          defaultNull: null,
          optionalPayload: null,
        })
        expect((yield* records.get({ id: created.id })).payload).toEqual(value)
        const updated = yield* records.update({
          id: created.id,
          payload: { previous: value },
        })
        expect(updated.payload).toEqual({ previous: value })
        expect(
          (yield* records.update({ id: created.id, payload: null })).payload
        ).toBeNull()
      }
      const events = yield* journal.list({ type: "jsonPayload.created" })
      expect(events.items.map((event) => event.data)).toEqual(
        values.map((payload) => expect.objectContaining({ payload }))
      )
      const table = database.table(Payload)
      const [row] = yield* database.sql<{
        requiredIsSqlNull: boolean
        optionalIsSqlNull: boolean
      }>`
      select ${table.columns.payload} is null as "requiredIsSqlNull",
        ${table.columns.optionalPayload} is null as "optionalIsSqlNull"
      from ${table} limit 1`
      expect(row).toEqual({ requiredIsSqlNull: false, optionalIsSqlNull: true })
    })
)
