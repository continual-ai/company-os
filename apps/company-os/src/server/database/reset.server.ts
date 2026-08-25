#!/usr/bin/env node
import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import { PgClient } from "@effect/sql-pg"
import { Config, Effect, Redacted } from "effect"

import { seedSystem } from "@/server/seeds/seed-system.server"

import { Database } from "./database.server"
import { applyMigrations } from "./migrations.server"
import * as Postgres from "./postgres.server"
import { localDatabaseTarget } from "./reset-target"

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
    "Database reset complete; all committed migrations applied and source-owned records converged."
  )
}).pipe(
  Effect.provide(Database.layer),
  Effect.provide(Postgres.layer),
  NodeRuntime.runMain
)
