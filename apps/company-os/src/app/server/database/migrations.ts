import { createHash } from "node:crypto"

import { PgClient } from "@effect/sql-pg"
import { Effect } from "effect"

import { databaseSchemaConfig } from "#/app/server/database/postgres.ts"
import { schemaSql } from "#/app/server/database/schema.ts"
import {
  applySchemaMigrations,
  verifySchemaMigrations,
} from "#/runtime/server/migrations.ts"

/**
 * Creates the deployment's business schema when it does not exist yet. The
 * first application to migrate on a fresh deployment owns this step; the
 * schema name is validated before it reaches DDL.
 */
export const ensureDatabaseSchema = Effect.fn("@company/ensureDatabaseSchema")(
  function* () {
    const schema = yield* databaseSchemaConfig
    if (schema === "public") return
    const sql = yield* PgClient.PgClient
    yield* sql.unsafe(`create schema if not exists "${schema}"`)
  }
)

// One pre-release baseline, derived from the same model as local resets. Its fingerprint makes
// deployment reject an outdated database instead of silently treating it as the current schema.
export const migrations = [
  {
    id: 1,
    name: `baseline_${createHash("sha256").update(schemaSql).digest("hex")}`,
    sql: `${schemaSql}\ninsert into event_journal_state (id, position) values (1, 0);`,
  },
]

export const applyMigrations = () => applySchemaMigrations(migrations)
export const verifyDatabaseModel = () => verifySchemaMigrations(migrations)
