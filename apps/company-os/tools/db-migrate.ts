import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import { PgClient } from "@effect/sql-pg"
import { Config, Effect, Option } from "effect"

import { loadEnvironment } from "@/environment"
import {
  applyMigrations,
  ensureDatabaseSchema,
} from "@/server/database/migrations"
import * as Postgres from "@/server/database/postgres"
import { seedSystem } from "@/server/seeds/seed-system"

loadEnvironment()

// Deployment sequencing lives in this application's own scripts, not in any
// platform: bundle:continual invokes this tool with --if-configured so the
// same command migrates wherever a database is configured and stays a pure
// build everywhere else.
const skipWhenUnconfigured = process.argv.includes("--if-configured")

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

const migrate = Effect.gen(function* () {
  yield* ensureDatabaseSchema()
  yield* adoptLegacyMigrationBookkeeping()
  yield* applyMigrations()
  yield* seedSystem()
  yield* Effect.log("Database migrated and required records converged.")
}).pipe(Effect.provide(Postgres.databaseAndClientLayer))

Effect.gen(function* () {
  const databaseUrl = yield* Config.option(Config.redacted("DATABASE_URL"))
  if (Option.isNone(databaseUrl) && skipWhenUnconfigured) {
    yield* Effect.log("DATABASE_URL is not configured; skipping migrations.")
    return
  }
  yield* migrate
}).pipe(NodeRuntime.runMain)
