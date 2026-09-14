import { createHash } from "node:crypto"

import { Effect } from "effect"
import * as Migrator from "effect/unstable/sql/Migrator"
import * as SqlClient from "effect/unstable/sql/SqlClient"

import {
  initialMigration,
  initialSql,
} from "#/app/server/database/migrations/0001-initial.ts"
import { assertDatabaseSchemaName } from "#/app/server/database/postgres.ts"
import { seedSystem } from "#/app/server/seeds/seed-system.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"
import { ensureSearchIndex } from "#/runtime/server/storage/search-index.ts"
import { SqlDatabase } from "#/runtime/server/storage/transactions.ts"

// Until v1 the initial migration follows the model. Its fingerprint prevents silent reuse of an old schema.
const initialName = `initial_${createHash("sha256").update(initialSql).digest("hex")}`
export const migrations = Migrator.fromRecord({
  [`1_${initialName}`]: initialMigration,
})

/** The same runner initializes deployments and reapplies the baseline after a development reset. */
export const migrateDatabaseSchema = Effect.fn(
  "@company/migrateDatabaseSchema"
)(function* (schema: string) {
  const name = assertDatabaseSchemaName(schema)
  const database = yield* SqlDatabase
  const { sql } = database
  const model = yield* ModelContext
  yield* sql.withTransaction(
    Effect.gen(function* () {
      yield* sql.unsafe(`create schema if not exists "${name}"`)
      yield* sql.unsafe(`set local search_path to "${name}"`)
      const [state] = yield* sql<{ tracked: boolean; occupied: boolean }>`
        select to_regclass('company_os_migrations') is not null as tracked,
          exists(select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = ${name})
          or exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = ${name}) as occupied
      `
      if (state?.occupied && !state.tracked)
        return yield* Effect.fail(
          new Error(
            "This schema has existing objects but no migration history. Use pnpm reset for disposable local data; retained data needs an explicit upgrade plan."
          )
        )
      // Create Effect's ledger before its missing-table probe so setup can join the atomic reset transaction.
      yield* sql`create table if not exists company_os_migrations (
        migration_id integer primary key,
        created_at timestamp with time zone not null default now(),
        name text not null
      )`
      yield* Migrator.make({})({
        loader: migrations,
        table: "company_os_migrations",
      }).pipe(Effect.provideService(SqlClient.SqlClient, sql))
      // The runner holds its lock until this enclosing transaction commits.
      const expected = yield* migrations
      const history = yield* sql<{
        id: number
        name: string
      }>`select migration_id as id, name from company_os_migrations`
      if (
        history.some(
          (row) =>
            !expected.some(
              ([id, migrationName]) =>
                id === row.id && migrationName === row.name
            )
        )
      )
        return yield* Effect.fail(
          new Error(
            "The applied migrations differ from this version. Before v1, update the initial migration and run pnpm reset for disposable local data. Never reset retained data without explicit authorization."
          )
        )
      yield* seedSystem()
      return yield* ensureSearchIndex(database, model)
    })
  )
})
