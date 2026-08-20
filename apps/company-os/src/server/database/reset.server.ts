#!/usr/bin/env node
import { fileURLToPath } from "node:url"

import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import { PgClient } from "@effect/sql-pg"
import { migrate } from "drizzle-orm/effect-postgres/migrator"
import { Config, Effect, Redacted } from "effect"

import { Database } from "./drizzle.server"
import * as Postgres from "./postgres.server"
import { localDatabaseTarget } from "./reset-target"

const migrationsFolder = fileURLToPath(new URL("./migrations", import.meta.url))

Effect.gen(function* () {
  const databaseUrl = yield* Config.redacted("DATABASE_URL")
  const confirmation = yield* Config.string("CONFIRM_DATABASE_RESET")
  const target = yield* Effect.try(() =>
    localDatabaseTarget(Redacted.value(databaseUrl), confirmation)
  )
  const sql = yield* PgClient.PgClient
  const database = yield* Database

  yield* Effect.log(
    `Resetting local PostgreSQL database '${target.databaseName}' on '${target.host}'.`
  )
  yield* sql`drop schema if exists drizzle cascade`
  yield* sql`drop schema if exists public cascade`
  yield* sql`create schema public`
  yield* migrate(database, { migrationsFolder })
  yield* Effect.log(
    "Database reset complete; all committed migrations applied."
  )
}).pipe(
  Effect.provide(Database.layer),
  Effect.provide(Postgres.layer),
  NodeRuntime.runMain
)
