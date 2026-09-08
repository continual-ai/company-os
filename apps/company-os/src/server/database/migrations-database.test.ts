import { Database } from "@company/runtime/server/database/database"
import { Effect, Exit } from "effect"
import * as Migrator from "effect/unstable/sql/Migrator"
import * as SqlClient from "effect/unstable/sql/SqlClient"
import { expect, inject, it } from "vitest"

import { applyMigrations } from "#/examples/schema.server.ts"
import { schemaSql } from "#/examples/schema.server.ts"
import { itDatabase } from "#/server/database/it-database.ts"
import { dumpSchema } from "#/server/database/schema-dump.ts"
import { TestDatabase } from "#/server/database/test-database.ts"

it("replayed migrations match the declared schema, including indexes, functions, and comments", async () => {
  const declared = await TestDatabase.createTemplate(schemaSql)
  try {
    const [actual, expected] = await Promise.all([
      dumpSchema(TestDatabase.url(inject("testDatabaseTemplate"))),
      dumpSchema(TestDatabase.url(declared)),
    ])
    expect(actual).toBe(expected)
  } finally {
    await TestDatabase.drop(declared)
  }
})

itDatabase("does not reapply completed migrations", () =>
  Effect.gen(function* () {
    yield* applyMigrations()
    yield* applyMigrations()
    const { sql } = yield* Database
    expect(
      yield* sql`select migration_id as id from company_os_migrations`
    ).toEqual([{ id: 1 }])
    expect(yield* sql`select id from event_journal_state`).toEqual([{ id: 1 }])
  })
)

itDatabase(
  "rolls back a failing whole-file migration, including function bodies",
  () =>
    Effect.gen(function* () {
      const { sql } = yield* Database
      const result = yield* Migrator.make({})({
        table: "test_migrations",
        loader: Migrator.fromRecord({
          "1_failure": Effect.gen(function* () {
            const client = yield* SqlClient.SqlClient
            yield* client.unsafe(`
            -- Semicolons inside comments and function bodies are not delimiters;
            create table migration_probe (id integer);
            create function migration_probe() returns integer language plpgsql as $$
            begin
              insert into migration_probe values (1);
              return 1;
            end;
            $$;
            select migration_probe();
            select 1 / 0;
          `)
          }),
        }),
      }).pipe(Effect.provideService(SqlClient.SqlClient, sql), Effect.exit)
      expect(Exit.isFailure(result)).toBe(true)
      expect(
        yield* sql`select to_regclass('migration_probe') as table_name,
      to_regprocedure('migration_probe()') as function_name`
      ).toEqual([{ table_name: null, function_name: null }])
    })
)
