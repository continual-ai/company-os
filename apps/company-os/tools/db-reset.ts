import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import { PgClient } from "@effect/sql-pg"
import { Config, Effect, Redacted } from "effect"

import { applyMigrations } from "@/server/database/migrations"
import * as Postgres from "@/server/database/postgres"
import { seedSystem } from "@/server/seeds/seed-system"

import { localDatabaseTarget } from "./db-reset-target"
import { loadLocalEnvironment } from "./local-environment"

loadLocalEnvironment()

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
  const schema = yield* Postgres.databaseSchemaConfig
  yield* sql.unsafe(`drop schema if exists "${schema}" cascade`)
  yield* sql.unsafe(`create schema "${schema}"`)
  yield* applyMigrations()
  yield* seedSystem()
  yield* Effect.log(
    "Database reset complete; all committed migrations applied and required records ensured."
  )
}).pipe(Effect.provide(Postgres.databaseAndClientLayer), NodeRuntime.runMain)
