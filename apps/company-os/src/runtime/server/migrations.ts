import { Effect } from "effect"
import * as Migrator from "effect/unstable/sql/Migrator"
import * as SqlClient from "effect/unstable/sql/SqlClient"

import { Database } from "#/runtime/server/storage/database.ts"

export interface SchemaMigration {
  readonly id: number
  readonly name: string
  readonly sql: string
}

function validateMigrations(migrations: ReadonlyArray<SchemaMigration>) {
  if (migrations.length === 0) throw new Error("No SQL migrations found.")
  for (const [index, migration] of migrations.entries()) {
    if (migration.id !== index + 1 || !/^[a-z][a-z0-9_]*$/.test(migration.name))
      throw new Error(
        "Migrations must have consecutive IDs starting at 1 and lowercase names."
      )
  }
}

const readMigrations = Effect.fn("@company/readMigrations")(function* () {
  const { sql } = yield* Database
  const [table] = yield* sql<{
    present: boolean
  }>`select to_regclass('company_os_migrations') is not null as present`
  return table?.present
    ? yield* sql<{
        id: number
        name: string
      }>`select migration_id as id, name from company_os_migrations order by migration_id`
    : []
})

function verifyHistory(
  history: ReadonlyArray<{ id: number; name: string }>,
  migrations: ReadonlyArray<SchemaMigration>
) {
  for (const row of history) {
    const expected = migrations.find((migration) => migration.id === row.id)
    if (!expected || row.name !== expected.name)
      throw new Error(
        `Database baseline differs from the current model. Use pnpm db:reset for disposable local data. Remote or retained data requires an explicit recovery plan.`
      )
  }
}

/** A database with tables but no ledger predates this baseline; the baseline would collide with it. */
const assertDatabaseEmpty = Effect.fn("@company/assertDatabaseEmpty")(
  function* () {
    const { sql } = yield* Database
    const [row] = yield* sql<{
      count: number
    }>`select count(*)::int as count from pg_tables where schemaname = current_schema()`
    if ((row?.count ?? 0) > 0)
      return yield* Effect.fail(
        new Error(
          "This database has tables but no migration history (for example, after db:reset). Keep using db:reset for development. Initialize deployments with pnpm db:migrate on a separate empty database."
        )
      )
    return yield* Effect.void
  }
)

/** Verifies the recorded baseline before deployment initialization proceeds. */
export const verifySchemaMigrations = Effect.fn(
  "@company/verifySchemaMigrations"
)(function* (migrations: ReadonlyArray<SchemaMigration>) {
  yield* Effect.try(() => validateMigrations(migrations))
  const history = yield* readMigrations()
  yield* Effect.try(() => verifyHistory(history, migrations))
  if (history.length !== migrations.length)
    return yield* Effect.fail(
      new Error(
        "Database initialization is pending. Run pnpm db:migrate on an empty deployment database."
      )
    )
  return yield* Effect.void
})

/** Runs ordered, committed SQL with Effect SQL's migration lock and transaction semantics. */
export const applySchemaMigrations = Effect.fn(
  "@company/applySchemaMigrations"
)(function* (migrations: ReadonlyArray<SchemaMigration>) {
  yield* Effect.try(() => validateMigrations(migrations))
  const database = yield* Database
  const history = yield* readMigrations()
  yield* Effect.try(() => verifyHistory(history, migrations))
  if (history.length === 0) yield* assertDatabaseEmpty()
  const records = Object.fromEntries(
    migrations.map((migration) => [
      `${migration.id}_${migration.name}`,
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient
        yield* sql.unsafe(migration.sql)
      }),
    ])
  )
  yield* Migrator.make({})({
    table: "company_os_migrations",
    loader: Migrator.fromRecord(records),
  }).pipe(Effect.provideService(SqlClient.SqlClient, database.sql))
  yield* verifySchemaMigrations(migrations)
})
