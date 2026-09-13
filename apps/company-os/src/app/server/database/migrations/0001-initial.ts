import { Effect } from "effect"
import * as SqlClient from "effect/unstable/sql/SqlClient"

import { schemaSql } from "#/app/server/database/schema.ts"

/** Mutable before v1: schema changes update this baseline, then development databases reset. */
export const initialSql = `${schemaSql}
insert into event_journal_state (id, position) values (1, 0);`

export const initialMigration = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  yield* sql.unsafe(initialSql)
})
