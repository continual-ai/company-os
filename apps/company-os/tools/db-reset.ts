import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import { PgClient } from "@effect/sql-pg"
import { Config, Effect, Redacted } from "effect"

import { loadEnvironment } from "@/environment"
import { applyMigrations } from "@/server/database/migrations"
import * as Postgres from "@/server/database/postgres"
import { seedSystem } from "@/server/seeds/seed-system"

import { localDatabaseTarget } from "./db-reset-target"

loadEnvironment()

Effect.gen(function* () {
  const databaseUrl = yield* Config.redacted("DATABASE_URL")
  const confirmation = yield* Config.string("CONFIRM_DATABASE_RESET")
  const target = yield* Effect.try(() =>
    localDatabaseTarget(Redacted.value(databaseUrl), confirmation)
  )
  const sql = yield* PgClient.PgClient

  yield* Effect.log(
    `Resetting local PostgreSQL database '${target.databaseName}' on '${target.host}'.`
  )
  yield* sql`drop schema if exists auth cascade`
  yield* sql`drop schema if exists drizzle cascade`
  yield* sql`drop schema if exists public cascade`
  yield* sql`create schema public`
  yield* applyMigrations()
  yield* seedSystem()
  yield* Effect.log(
    "Database reset complete; all committed migrations applied and required records converged."
  )
}).pipe(Effect.provide(Postgres.databaseAndClientLayer), NodeRuntime.runMain)
