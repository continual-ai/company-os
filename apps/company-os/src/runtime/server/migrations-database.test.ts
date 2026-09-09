import { Effect, Exit } from "effect"
import { expect } from "vitest"

import {
  applySchemaMigrations,
  schemaHash,
  verifySchemaMigrations,
} from "#/runtime/server/migrations.ts"
import { Database } from "#/runtime/server/storage/database.ts"
import { testDatabase } from "#/runtime/testing/database.ts"
import { kernelModel } from "#/runtime/testing/fixture-model.ts"

const fixture = testDatabase(kernelModel, "")

fixture.test(
  "keeps applied SQL immutable and evolves retained rows through numbered migrations",
  () =>
    Effect.gen(function* () {
      const first = {
        id: 1,
        name: "initial",
        sql: "create table probe (id integer primary key, name text not null);",
        schemaHash: schemaHash("first"),
      }
      const second = {
        id: 2,
        name: "add_priority",
        sql: "alter table probe add column priority text not null default 'normal';",
        schemaHash: schemaHash("second"),
      }
      const { sql } = yield* Database
      yield* applySchemaMigrations([first], first.schemaHash)
      yield* sql`insert into probe values (1, 'Retain me')`
      expect(
        Exit.isFailure(
          yield* verifySchemaMigrations(
            [first, second],
            second.schemaHash
          ).pipe(Effect.exit)
        )
      ).toBe(true)
      expect(
        Exit.isFailure(
          yield* applySchemaMigrations(
            [{ ...first, sql: first.sql + "select 1;" }],
            first.schemaHash
          ).pipe(Effect.exit)
        )
      ).toBe(true)
      expect(
        Exit.isFailure(
          yield* applySchemaMigrations([first], second.schemaHash).pipe(
            Effect.exit
          )
        )
      ).toBe(true)
      yield* applySchemaMigrations([first, second], second.schemaHash)
      yield* applySchemaMigrations([first, second], second.schemaHash)
      expect(yield* sql`select * from probe`).toEqual([
        { id: 1, name: "Retain me", priority: "normal" },
      ])
    })
)
