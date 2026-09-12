import { writeFileSync } from "node:fs"
import { parseArgs } from "node:util"

import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import { Config, Effect, Redacted } from "effect"

import { localDatabaseTarget } from "#/app/server/database/db-reset-target.ts"
import { ensureLocalDatabase } from "#/app/server/database/local-database.ts"
import * as Postgres from "#/app/server/database/postgres.ts"
import { resetDevelopmentSchema } from "#/app/server/database/reset.ts"
import { schemaSql } from "#/app/server/database/schema.ts"
import { localConfigLayer } from "#/app/server/local-config.ts"

parseArgs({ options: {} })

Effect.gen(function* () {
  const databaseUrl = yield* Config.redacted("DATABASE_URL")
  const schema = yield* Postgres.databaseSchemaConfig
  const target = yield* Effect.try(() =>
    localDatabaseTarget(Redacted.value(databaseUrl))
  )
  yield* Effect.log(
    `Rebuilding local database '${target.databaseName}', schema '${schema}', from the model. Local data will be deleted.`
  )
  yield* ensureLocalDatabase(Redacted.value(databaseUrl))
  yield* resetDevelopmentSchema(schema).pipe(
    Effect.provide(Postgres.databaseLayer)
  )
  yield* Effect.try(() =>
    writeFileSync(new URL("../schema.sql", import.meta.url), schemaSql)
  )
  yield* Effect.log(
    "Development database ready. Run pnpm db:seed for example records, then pnpm dev."
  )
}).pipe(
  Effect.provide(localConfigLayer({ development: true })),
  NodeRuntime.runMain
)
