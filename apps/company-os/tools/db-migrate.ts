import { parseArgs } from "node:util"

import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import { Config, Effect, Redacted } from "effect"

import { ensureLocalDatabase } from "#/app/server/database/local-database.ts"
import { migrateDatabaseSchema } from "#/app/server/database/migrations.ts"
import * as Postgres from "#/app/server/database/postgres.ts"
import { localConfigLayer } from "#/app/server/local-config.ts"

parseArgs({ options: {} })

Effect.gen(function* () {
  const url = yield* Config.redacted("DATABASE_URL")
  const schema = yield* Postgres.databaseSchemaConfig
  yield* ensureLocalDatabase(Redacted.value(url))
  yield* migrateDatabaseSchema(schema).pipe(
    Effect.provide(Postgres.databaseLayer)
  )
  yield* Effect.log(
    "Database migrations applied; system records and search are ready."
  )
}).pipe(
  Effect.provide(localConfigLayer({ development: true })),
  NodeRuntime.runMain
)
