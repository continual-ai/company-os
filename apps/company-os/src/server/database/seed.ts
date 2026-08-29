import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import { Effect, Layer } from "effect"

import { PageTokens } from "@/server/page-tokens"
import { seedSystem } from "@/server/seeds/seed-system"

import * as Postgres from "./postgres"

Effect.gen(function* () {
  yield* seedSystem()
  yield* Effect.log("System records converged.")
}).pipe(
  Effect.provide(Layer.merge(Postgres.databaseLayer, PageTokens.layer)),
  NodeRuntime.runMain
)
