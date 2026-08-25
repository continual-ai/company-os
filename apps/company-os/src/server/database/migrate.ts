#!/usr/bin/env node
import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import { Effect } from "effect"

import { Database } from "./database"
import { applyMigrations } from "./migrations"
import * as Postgres from "./postgres"

Effect.gen(function* () {
  yield* applyMigrations()
  yield* Effect.log("Database migrations applied.")
}).pipe(
  Effect.provide(Database.layer),
  Effect.provide(Postgres.layer),
  NodeRuntime.runMain
)
