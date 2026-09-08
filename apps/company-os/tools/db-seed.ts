import { parseArgs } from "node:util"

import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import { Config, Effect, Redacted } from "effect"

import { developmentSeedTarget } from "#/server/database/db-seed-target.ts"
import { databaseLayer } from "#/server/database/postgres.ts"
import { loadLocalEnvironment } from "#/server/local-environment.ts"
import { demoScenario } from "#/server/seeds/demo-scenario.ts"
import { performanceScenario } from "#/server/seeds/performance-scenario.ts"
import { runSeedScenario } from "#/server/seeds/run-seed-scenario.ts"
import { seedSystem } from "#/server/seeds/seed-system.ts"

const { values } = parseArgs({
  options: {
    scenario: { type: "string", default: "demo" },
    size: { type: "string" },
    help: { type: "boolean" },
  },
})
if (values.help) {
  console.log(
    "pnpm db:seed --scenario demo|performance [--size 1000]\nRun db:migrate first. Scenarios run once per database and preserve later edits. Remote targets require CONFIRM_DEVELOPMENT_DATABASE=host/database."
  )
} else {
  if (values.scenario !== "demo" && values.scenario !== "performance")
    throw new Error("Choose scenario demo or performance.")
  if (values.scenario === "demo" && values.size !== undefined)
    throw new Error("--size applies only to the performance scenario.")
  const scenario =
    values.scenario === "demo"
      ? demoScenario
      : performanceScenario(Number(values.size ?? 1000))
  loadLocalEnvironment()
  Effect.gen(function* () {
    const url = yield* Config.redacted("DATABASE_URL")
    const confirmation = yield* Config.string(
      "CONFIRM_DEVELOPMENT_DATABASE"
    ).pipe(Config.withDefault(""))
    const environment = yield* Config.string("NODE_ENV").pipe(
      Config.withDefault("development")
    )
    const target = yield* Effect.try(() =>
      developmentSeedTarget(Redacted.value(url), confirmation, environment)
    )
    yield* Effect.log(`Seeding '${scenario.name}' into ${target}.`)
    yield* seedSystem()
    const result = yield* runSeedScenario(scenario)
    yield* Effect.log(`${scenario.name}: ${result}.`)
  }).pipe(Effect.provide(databaseLayer), NodeRuntime.runMain)
}
