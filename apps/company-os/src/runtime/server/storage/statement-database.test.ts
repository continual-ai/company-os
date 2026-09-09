import { Effect } from "effect"
import { expect } from "vitest"

import { Database } from "#/runtime/server/storage/database.ts"
import {
  assignments,
  defineTable,
  insertValues,
  tableProjection,
  type TableRow,
} from "#/runtime/server/storage/index.ts"
import { testDatabase } from "#/runtime/testing/database.ts"
import { kernelModel } from "#/runtime/testing/fixture-model.ts"

const fixture = testDatabase(kernelModel)

fixture.test(
  "keeps multiline descriptions as source comments without database metadata",
  () =>
    Effect.gen(function* () {
      const { sql } = yield* Database
      const table = defineTable<{ id: number }>(
        "documented_record",
        {
          id: {
            type: "integer",
            description:
              "A record identifier.\n); drop table documented_record; --",
          },
        },
        { description: "A table's description.\r\nselect 1;" }
      )
      yield* sql.unsafe(
        table.ddl.map((statement) => `${statement};`).join("\n\n")
      )
      yield* sql`insert into documented_record values (1)`
      expect(yield* sql`select id from documented_record`).toEqual([{ id: 1 }])
      expect(
        yield* sql`select
      obj_description('documented_record'::regclass) as table_comment,
      col_description('documented_record'::regclass, 1) as column_comment`
      ).toEqual([{ table_comment: null, column_comment: null }])
    })
)

fixture.test(
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
