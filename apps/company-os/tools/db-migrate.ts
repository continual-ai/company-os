import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import { PgClient } from "@effect/sql-pg"
import { Effect } from "effect"

import { loadEnvironment } from "@/environment"
import {
  applyMigrations,
  ensureDatabaseSchema,
} from "@/server/database/migrations"
import * as Postgres from "@/server/database/postgres"
import { seedSystem } from "@/server/seeds/seed-system"

loadEnvironment()

/**
 * Databases migrated before per-application bookkeeping still record history
 * in drizzle's default table. Moving those rows once preserves the applied
 * history; without this, migration replay fails on every pre-existing
 * database.
 */
const adoptLegacyMigrationBookkeeping = Effect.fn(
  "@company/adoptLegacyMigrationBookkeeping"
)(function* () {
  const schema = yield* Postgres.databaseSchemaConfig
  const sql = yield* PgClient.PgClient
  const rows = yield* sql<{
    current: string | null
    legacy: string | null
  }>`
    select
      to_regclass('drizzle.__drizzle_migrations') as legacy,
      to_regclass(${`${schema}.__drizzle_migrations_company_os`}) as current
  `
  const row = rows[0]
  if (row === undefined || row.legacy === null || row.current !== null) return
  yield* sql.unsafe(
    `alter table drizzle.__drizzle_migrations set schema "${schema}"`
  )
  yield* sql.unsafe(
    `alter table "${schema}".__drizzle_migrations rename to __drizzle_migrations_company_os`
  )
})

Effect.gen(function* () {
  yield* ensureDatabaseSchema()
  yield* adoptLegacyMigrationBookkeeping()
  yield* applyMigrations()
  yield* seedSystem()
  yield* Effect.log("Database migrated and required records converged.")
}).pipe(Effect.provide(Postgres.databaseAndClientLayer), NodeRuntime.runMain)
