#!/usr/bin/env node
import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import { Effect } from "effect"

import { seedSystem } from "@/server/seeds/seed-system"

import { Database } from "./database"
import { applyMigrations } from "./migrations"
import * as Postgres from "./postgres"

Effect.gen(function* () {
  yield* applyMigrations()
  yield* seedSystem()
  yield* Effect.log("Database migrated and source-owned records converged.")
}).pipe(
  Effect.provide(Database.layer),
  Effect.provide(Postgres.layer),
  NodeRuntime.runMain
)
