import { Database } from "@company/runtime/server/database/database"
import {
  assignments,
  defineTable,
  insertValues,
  tableProjection,
  type TableRow,
} from "@company/runtime/server/postgres"
import { Effect } from "effect"
import { expect } from "vitest"

import { itDatabase } from "#/server/database/it-database.ts"

itDatabase(
  "preserves SQL expressions, JSON arrays, defaults, and model names at the driver boundary",
  () =>
    Effect.gen(function* () {
      const { sql } = yield* Database
      yield* sql.withTransaction(
        Effect.gen(function* () {
          const records = defineTable<{
            id: number
            name: string
            segments: string
            payload: unknown
            timestamps: ReadonlyArray<string>
            decimals: ReadonlyArray<string>
            count: number
          }>('codec "records', {
            id: { type: "integer" },
            name: { type: "text" },
            segments: { type: "text" },
            payload: { type: "jsonb" },
            timestamps: { type: "timestamp with time zone[]" },
            decimals: { type: "numeric[]" },
            count: { type: "integer" },
          })
          yield* sql`create temporary table ${records} (
      id integer primary key, name text not null, segments text not null,
      payload jsonb not null, timestamps timestamptz[] not null, decimals numeric[] not null, count integer default 7
    )`
          const text = "O'Reilly'); drop table objects; --"
          const decimals = ["9007199254740993.1234567890123456789"]
          const timestamps = ["2026-09-07T12:00:00.000Z"]
          yield* sql`insert into ${records} ${insertValues(sql, records, [
            {
              id: 1,
              name: text,
              segments: "A",
              payload: [{ nested_key: ["one", "two"] }],
              timestamps,
              decimals,
              count: 2,
            },
            {
              id: 2,
              name: "Default",
              segments: "B",
              payload: [],
              timestamps,
              decimals,
            },
          ])}`
          yield* sql`update ${records} set ${assignments(sql, records, {
            count: sql`${records.columns.count} + 1`,
            payload: ["updated", { snake_key: true }],
          })} where ${records.columns.id} = ${1}`
          const rows = yield* sql<
            TableRow<typeof records>
          >`select ${tableProjection(records)} from ${records} order by ${records.columns.id}`
          expect(rows).toEqual([
            {
              id: 1,
              name: text,
              segments: "A",
              payload: ["updated", { snake_key: true }],
              timestamps,
              decimals,
              count: 3,
            },
            {
              id: 2,
              name: "Default",
              segments: "B",
              payload: [],
              timestamps,
              decimals,
              count: 7,
            },
          ])
        })
      )
    })
)
