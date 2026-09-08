import {
  applySchemaMigrations,
  verifySchemaMigrations,
  schemaHash,
} from "@company/runtime/server/migrations"
import { PgClient } from "@effect/sql-pg"
import { Effect } from "effect"

import { migrations } from "#/server/database/migrations/index.ts"
import { databaseSchemaConfig } from "#/server/database/postgres.ts"
import { schemaSql } from "#/server/database/schema.ts"

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
export const applyMigrations = () =>
  applySchemaMigrations(migrations, schemaHash(schemaSql))
export const verifyDatabaseModel = () =>
  verifySchemaMigrations(migrations, schemaHash(schemaSql))
