import { PgClient } from "@effect/sql-pg"
import { Effect } from "effect"

import { migrations } from "#/app/server/database/migrations/index.ts"
import { databaseSchemaConfig } from "#/app/server/database/postgres.ts"
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

/** App-owned immutable migration sequence. */
export const applyMigrations = () => applySchemaMigrations(migrations)
export const verifyDatabaseModel = () => verifySchemaMigrations(migrations)
