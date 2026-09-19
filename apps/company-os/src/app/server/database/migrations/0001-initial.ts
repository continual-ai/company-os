import { Effect } from "effect"
import * as SqlClient from "effect/unstable/sql/SqlClient"

import { Model } from "#/app.model.ts"
import { schemaSql } from "#/app/server/database/schema.ts"
import {
  makeSchemaStatements,
  initialJournalSql,
} from "#/runtime/server/schema.ts"

/** Mutable before v1: schema changes update this baseline, then development databases reset. */
export const initialSql = `${schemaSql}
${initialJournalSql};`

export const initialMigration = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  for (const statement of makeSchemaStatements(Model)) {
    if (!statement.startsWith("--")) yield* sql.unsafe(statement)
  }
  yield* sql.unsafe(initialJournalSql)
})
