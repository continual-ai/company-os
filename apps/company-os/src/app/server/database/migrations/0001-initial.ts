import { Effect } from "effect"
import * as SqlClient from "effect/unstable/sql/SqlClient"

import { Model } from "#/app.model.ts"
import { schemaSql } from "#/app/server/database/schema.ts"
import { makeSchemaStatements } from "#/runtime/server/schema.ts"

/** Mutable before v1: schema changes update this baseline, then development databases reset. */
export const initialSql = `${schemaSql}
insert into event_journal_state (id, position) values (1, 0);`

export const initialMigration = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  for (const statement of makeSchemaStatements(Model)) {
    if (!statement.startsWith("--")) yield* sql.unsafe(statement)
  }
  yield* sql`insert into event_journal_state (id, position) values (1, 0)`
})
