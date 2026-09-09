import { createHash } from "node:crypto"

import { Effect } from "effect"
import * as Migrator from "effect/unstable/sql/Migrator"
import * as SqlClient from "effect/unstable/sql/SqlClient"

import { Database } from "#/runtime/server/database/database.ts"

export interface SchemaMigration {
  readonly id: number
  readonly name: string
  readonly sql: string
  /** Hash of the complete projected schema after this migration. */
  readonly schemaHash: string
}

export function schemaHash(sql: string): string {
  return createHash("sha256").update(sql).digest("hex")
}

function migrationName(migration: SchemaMigration) {
  return `${migration.name}_${schemaHash(migration.sql)}_${migration.schemaHash}`
}

function validateMigrations(
  migrations: ReadonlyArray<SchemaMigration>,
  expectedHash: string
) {
  if (migrations.length === 0 || migrations.at(-1)?.schemaHash !== expectedHash)
    throw new Error(
      "The model differs from the migration sequence. Regenerate the disposable baseline or add a migration for retained data."
    )
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
    if (!expected || row.name !== migrationName(expected))
      throw new Error(
        `Migration ${row.id} differs from the installed history. Restore the applied migration; add a new migration for subsequent changes.`
      )
  }
}

/** Applied SQL is immutable; startup also refuses databases missing a required migration. */
export const verifySchemaMigrations = Effect.fn(
  "@company/verifySchemaMigrations"
)(function* (migrations: ReadonlyArray<SchemaMigration>, expectedHash: string) {
  yield* Effect.try(() => validateMigrations(migrations, expectedHash))
  const history = yield* readMigrations()
  yield* Effect.try(() => verifyHistory(history, migrations))
  if (history.length !== migrations.length)
    return yield* Effect.fail(
      new Error(
        "Database migrations are pending. Run pnpm db:migrate before starting the app."
      )
    )
  return yield* Effect.void
})

/** Runs ordered, committed SQL with Effect SQL's migration lock and transaction semantics. */
export const applySchemaMigrations = Effect.fn(
  "@company/applySchemaMigrations"
)(function* (migrations: ReadonlyArray<SchemaMigration>, expectedHash: string) {
  yield* Effect.try(() => validateMigrations(migrations, expectedHash))
  const database = yield* Database
  const history = yield* readMigrations()
  yield* Effect.try(() => verifyHistory(history, migrations))
  const records = Object.fromEntries(
    migrations.map((migration) => [
      `${migration.id}_${migrationName(migration)}`,
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
  yield* verifySchemaMigrations(migrations, expectedHash)
})
