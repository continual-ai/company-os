#!/usr/bin/env node
import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import { Effect } from "effect"

import { seedCompanyOs } from "@/server/seeds/seed-company-os.server"

import { Database } from "./database.server"
import { applyMigrations } from "./migrations.server"
import * as Postgres from "./postgres.server"

Effect.gen(function* () {
  yield* applyMigrations()
  yield* seedCompanyOs()
  yield* Effect.log("Database migrated and source-owned records converged.")
}).pipe(
  Effect.provide(Database.layer),
  Effect.provide(Postgres.layer),
  NodeRuntime.runMain
)
