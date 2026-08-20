#!/usr/bin/env node
import { fileURLToPath } from "node:url"

import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import { migrate } from "drizzle-orm/effect-postgres/migrator"
import { Effect } from "effect"

import { Database } from "./drizzle.server"
import * as Postgres from "./postgres.server"

const migrationsFolder = fileURLToPath(new URL("./migrations", import.meta.url))

Effect.gen(function* () {
  const database = yield* Database
  yield* migrate(database, { migrationsFolder })
  yield* Effect.log("Database migrations applied.")
}).pipe(
  Effect.provide(Database.layer),
  Effect.provide(Postgres.layer),
  NodeRuntime.runMain
)
