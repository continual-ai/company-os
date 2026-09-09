import { parseArgs } from "node:util"

import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import { Config, Effect, Redacted } from "effect"

import { demoScenario } from "#/app/seeds/demo.server.ts"
import { performanceScenario } from "#/app/seeds/performance.server.ts"
import { runSeedScenario } from "#/app/server/application-services.ts"
import { developmentSeedTarget } from "#/app/server/database/db-seed-target.ts"
import { databaseLayer } from "#/app/server/database/postgres.ts"
import { withLocalConfig } from "#/app/server/local-config.ts"
import { seedSystem } from "#/app/server/seeds/seed-system.ts"

const { values } = parseArgs({
  options: {
    help: { type: "boolean" },
    scenario: { type: "string", default: "all" },
    size: { type: "string", default: "1000" },
  },
})
if (values.help) {
  console.log(
    "pnpm db:seed [--scenario all|demo|performance] [--size 1000]\nRun db:migrate first. Defaults to connected demo records plus realistic data across every business module. Size is the number of contacts and leads (1–10000); related records scale with it. Scenarios run once and preserve subsequent edits. Use a fresh development database to change size."
  )
} else {
  if (!["all", "demo", "performance"].includes(values.scenario))
    throw new Error("Scenario must be all, demo, or performance.")
  const performance = performanceScenario(Number(values.size))
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
    yield* Effect.log(`Seeding system records into ${target}.`)
    yield* seedSystem()
    if (values.scenario !== "performance")
      yield* Effect.log(`Demo: ${yield* runSeedScenario(demoScenario)}.`)
    if (values.scenario !== "demo")
      yield* Effect.log(
        `Performance (${values.size} contacts): ${yield* runSeedScenario(performance)}.`
      )
    yield* Effect.log("Development data ready. Open http://localhost:3002.")
  }).pipe(
    Effect.provide(withLocalConfig(databaseLayer, { development: true })),
    NodeRuntime.runMain
  )
}
