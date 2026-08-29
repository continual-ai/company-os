#!/usr/bin/env node
import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import { Effect, Layer } from "effect"

import { PageTokens } from "@/server/page-tokens"
import { seedSystem } from "@/server/seeds/seed-system"

import { applyMigrations } from "./migrations"
import * as Postgres from "./postgres"

Effect.gen(function* () {
  yield* applyMigrations()
  yield* seedSystem()
  yield* Effect.log("Database migrated and required records converged.")
}).pipe(
  Effect.provide(Layer.merge(Postgres.databaseLayer, PageTokens.layer)),
  NodeRuntime.runMain
)
