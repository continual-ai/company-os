import { parseArgs } from "node:util"

import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import { Config, Effect, Redacted } from "effect"

import { developmentSeedTarget } from "#/app/server/database/db-seed-target.ts"
import { databaseLayer } from "#/app/server/database/postgres.ts"
import { withLocalConfig } from "#/app/server/local-config.ts"
import { seedSystem } from "#/app/server/seeds/seed-system.ts"

const { values } = parseArgs({ options: { help: { type: "boolean" } } })
if (values.help) {
  console.log(
    "pnpm db:seed\nRun db:migrate first. Creates required system records. Add an explicit business scenario in tools/db-seed.ts when installing business modules."
  )
} else {
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
    yield* Effect.log("System records ready.")
  }).pipe(
    Effect.provide(withLocalConfig(databaseLayer, { development: true })),
    NodeRuntime.runMain
  )
}
