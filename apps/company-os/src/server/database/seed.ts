import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import { Effect } from "effect"

import { seedSystem } from "@/server/seeds/seed-system"

import { Database } from "./database"
import * as Postgres from "./postgres"

Effect.gen(function* () {
  yield* seedSystem()
  yield* Effect.log("System records converged.")
}).pipe(
  Effect.provide(Database.layer),
  Effect.provide(Postgres.layer),
  NodeRuntime.runMain
)
