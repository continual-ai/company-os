import { Effect } from "effect"

import { assertDatabaseSchemaName } from "#/app/server/database/postgres.ts"
import { schemaSql } from "#/app/server/database/schema.ts"
import { seedSystem } from "#/app/server/seeds/seed-system.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"
import { ensureSearchIndex } from "#/runtime/server/storage/search-index.ts"
import { SqlDatabase } from "#/runtime/server/storage/transactions.ts"

/** Rebuilds disposable storage from the model, without claiming any migrations were applied. */
export const resetDevelopmentSchema = Effect.fn(
  "@company/resetDevelopmentSchema"
)(function* (schema: string) {
  const name = assertDatabaseSchemaName(schema)
  const database = yield* SqlDatabase
  const model = yield* ModelContext
  yield* database.sql.withTransaction(
    Effect.gen(function* () {
      yield* database.sql.unsafe(`drop schema if exists "${name}" cascade`)
      yield* database.sql.unsafe(`create schema "${name}"`)
      yield* database.sql.unsafe(schemaSql)
      yield* database.sql`insert into event_journal_state (id, position) values (1, 0)`
      yield* seedSystem()
      yield* ensureSearchIndex(database, model)
    })
  )
})
