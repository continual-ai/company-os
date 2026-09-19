import { Effect } from "effect"
import * as SqlClient from "effect/unstable/sql/SqlClient"

import { Model } from "#/app.model.ts"
import {
  makeSchemaStatements,
  initialJournalSql,
} from "#/runtime/server/schema.ts"

/** Mutable before v1: schema changes update this baseline, then development databases reset. */
export const initialStatements = [
  ...makeSchemaStatements(Model),
  initialJournalSql,
]

export const initialMigration = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  for (const statement of initialStatements) yield* sql.unsafe(statement)
})
