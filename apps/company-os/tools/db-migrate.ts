import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import { Effect } from "effect"

import { loadEnvironment } from "@/environment"
import { applyMigrations } from "@/server/database/migrations"
import * as Postgres from "@/server/database/postgres"
import { seedSystem } from "@/server/seeds/seed-system"

loadEnvironment()

Effect.gen(function* () {
  yield* applyMigrations()
  yield* seedSystem()
  yield* Effect.log("Database migrated and required records converged.")
}).pipe(Effect.provide(Postgres.databaseLayer), NodeRuntime.runMain)
