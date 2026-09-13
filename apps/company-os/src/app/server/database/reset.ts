import { Effect } from "effect"

import { migrateDatabaseSchema } from "#/app/server/database/migrations.ts"
import { assertDatabaseSchemaName } from "#/app/server/database/postgres.ts"
import { SqlDatabase } from "#/runtime/server/storage/transactions.ts"

/** Discards disposable storage and builds the current model in one transaction. */
export const resetDevelopmentSchema = Effect.fn(
  "@company/resetDevelopmentSchema"
)(function* (schema: string) {
  const name = assertDatabaseSchemaName(schema)
  const { sql } = yield* SqlDatabase
  yield* sql.withTransaction(
    Effect.gen(function* () {
      yield* sql.unsafe(`drop schema if exists "${name}" cascade`)
      yield* migrateDatabaseSchema(name)
    })
  )
})
