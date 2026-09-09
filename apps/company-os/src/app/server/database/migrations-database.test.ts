import { Effect, Exit } from "effect"
import * as Migrator from "effect/unstable/sql/Migrator"
import * as SqlClient from "effect/unstable/sql/SqlClient"
import { expect, it } from "vitest"

import { Model } from "#/app.model.ts"
import {
  applyMigrations,
  verifyDatabaseModel,
} from "#/app/server/database/migrations.ts"
import { schemaSql } from "#/app/server/database/schema.ts"
import { testApplication } from "#/app/server/test-application.ts"
import { Database } from "#/runtime/server/storage/database.ts"
import { TestDatabase } from "#/runtime/server/storage/testing.ts"
import { testDatabase } from "#/runtime/testing/database.ts"
import { readSchemaCatalog } from "#/runtime/testing/schema-catalog.ts"

const application = testApplication()
const empty = testDatabase(Model, "")

it("replayed migrations match the declared schema, including indexes, functions, and comments", async () => {
  const declared = await TestDatabase.createTemplate(schemaSql)
  try {
    const [migrated, expected] = await Promise.all([
      readSchemaCatalog(TestDatabase.url(await application.template())),
      readSchemaCatalog(TestDatabase.url(declared)),
    ])
    expect(migrated.tables.length).toBeGreaterThan(10)
    expect(migrated).toEqual(expected)
  } finally {
    await TestDatabase.drop(declared)
  }
})

application.test("does not reapply completed migrations", () =>
  Effect.gen(function* () {
    yield* verifyDatabaseModel()
    yield* applyMigrations()
    yield* applyMigrations()
    const { sql } = yield* Database
    expect(
      yield* sql`select migration_id as id from company_os_migrations`
    ).toEqual([{ id: 1 }])
    expect(yield* sql`select id from event_journal_state`).toEqual([{ id: 1 }])
  })
)

application.test(
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

empty.test("refuses to start before the committed baseline is applied", () =>
  Effect.gen(function* () {
    expect(Exit.isFailure(yield* verifyDatabaseModel().pipe(Effect.exit))).toBe(
      true
    )
    yield* applyMigrations()
    yield* verifyDatabaseModel()
    const { sql } = yield* Database
    expect(yield* sql`select to_regclass('objects')::text as registry`).toEqual(
      [{ registry: "objects" }]
    )
  })
)
