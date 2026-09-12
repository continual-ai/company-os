import { PgClient } from "@effect/sql-pg"
import { Effect, Exit, Layer, Redacted } from "effect"
import * as Migrator from "effect/unstable/sql/Migrator"
import * as SqlClient from "effect/unstable/sql/SqlClient"
import { expect, it } from "vitest"

import { Model } from "#/app.model.ts"
import {
  applyMigrations,
  migrations,
  verifyDatabaseModel,
} from "#/app/server/database/migrations.ts"
import { schemaSql } from "#/app/server/database/schema.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"
import { Database } from "#/runtime/server/storage/database.ts"
import { pgTypes } from "#/runtime/server/storage/index.ts"
import { TestDatabase } from "#/runtime/server/storage/testing.ts"
import { testDatabase } from "#/runtime/testing/database.ts"
import { readSchemaCatalog } from "#/runtime/testing/schema-catalog.ts"

const application = testDatabase(
  Model,
  async (url) => {
    await Effect.runPromise(
      Effect.scoped(
        applyMigrations().pipe(
          Effect.provide(
            Database.layer.pipe(
              Layer.provideMerge(ModelContext.layer(Model)),
              Layer.provide(
                PgClient.layer({ url: Redacted.make(url), types: pgTypes })
              )
            )
          )
        )
      )
    )
  },
  `migrations:${JSON.stringify(migrations)}`
)
const empty = testDatabase(Model, "")

it("replayed migrations match the declared structure, including indexes, functions, and triggers", async () => {
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
    ).toEqual(migrations.map(({ id }) => ({ id })))
    expect(yield* sql`select id from event_journal_state`).toEqual([{ id: 1 }])
  })
)

application.test(
  "refuses an outdated baseline without changing existing data",
  () =>
    Effect.gen(function* () {
      const { sql } = yield* Database
      yield* sql`create table retained_probe (value text)`
      yield* sql`insert into retained_probe values ('keep me')`
      yield* sql`update company_os_migrations set name = 'baseline_outdated'`

      const result = yield* applyMigrations().pipe(Effect.exit)
      expect(Exit.isFailure(result)).toBe(true)
      expect(yield* sql`select value from retained_probe`).toEqual([
        { value: "keep me" },
      ])
      expect(yield* sql`select name from company_os_migrations`).toEqual([
        { name: "baseline_outdated" },
      ])
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
