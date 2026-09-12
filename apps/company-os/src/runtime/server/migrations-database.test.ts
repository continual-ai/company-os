import { Effect, Exit } from "effect"
import { expect } from "vitest"

import {
  applySchemaMigrations,
  verifySchemaMigrations,
} from "#/runtime/server/migrations.ts"
import { Database } from "#/runtime/server/storage/database.ts"
import { testDatabase } from "#/runtime/testing/database.ts"
import { kernelModel } from "#/runtime/testing/fixture-model.ts"

const fixture = testDatabase(kernelModel, "")

fixture.test(
  "evolves retained rows in order without replaying previously applied migrations",
  () =>
    Effect.gen(function* () {
      const first = {
        id: 1,
        name: "initial",
        sql: "create table probe (id integer primary key, name text not null);",
      }
      const second = {
        id: 2,
        name: "add_priority",
        sql: "alter table probe add column priority text not null default 'normal';",
      }
      const { sql } = yield* Database
      yield* applySchemaMigrations([first])
      yield* sql`insert into probe values (1, 'Retain me')`
      yield* verifySchemaMigrations([first])
      expect(
        Exit.isFailure(
          yield* verifySchemaMigrations([first, second]).pipe(Effect.exit)
        )
      ).toBe(true)
      expect(
        Exit.isFailure(
          yield* applySchemaMigrations([{ ...first, name: "renamed" }]).pipe(
            Effect.exit
          )
        )
      ).toBe(true)
      yield* applySchemaMigrations([first, second])
      yield* applySchemaMigrations([first, second])
      expect(yield* sql`select * from probe`).toEqual([
        { id: 1, name: "Retain me", priority: "normal" },
      ])
      expect(
        yield* sql`select name from company_os_migrations where migration_id = 2`
      ).toEqual([{ name: "add_priority" }])
    })
)
