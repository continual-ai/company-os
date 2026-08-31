import { fileURLToPath } from "node:url"

import { PgClient } from "@effect/sql-pg"
import { migrate } from "drizzle-orm/effect-postgres/migrator"
import { Effect } from "effect"

import { Database } from "./database"
import { databaseSchemaConfig } from "./postgres"

const migrationsFolder = fileURLToPath(new URL("./migrations", import.meta.url))

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

/**
 * Applies the committed, forward-only database migration history. Migration
 * bookkeeping lives in the deployment schema under an application-specific
 * table so other company applications can migrate the shared schema without
 * colliding.
 */
export const applyMigrations = Effect.fn("@company/applyMigrations")(
  function* () {
    const schema = yield* databaseSchemaConfig
    const database = yield* Database
    yield* migrate(database, {
      migrationsFolder,
      migrationsSchema: schema,
      migrationsTable: "__drizzle_migrations_company_os",
    })
  }
)
