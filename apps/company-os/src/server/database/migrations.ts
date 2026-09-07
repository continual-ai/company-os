import { readFile } from "node:fs/promises"

import { PgClient } from "@effect/sql-pg"
import { Effect } from "effect"
import * as Migrator from "effect/unstable/sql/Migrator"
import * as SqlClient from "effect/unstable/sql/SqlClient"

import { Database } from "./database"
import { databaseSchemaConfig } from "./postgres"

const sqlMigration = (file: URL) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const source = yield* Effect.tryPromise(() => readFile(file, "utf8"))
    // The driver executes the complete checked-in file, including function bodies.
    yield* sql.unsafe(source)
  })

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
 * Installs the template baseline and any migrations added by its owner. Migration
 * bookkeeping lives in the deployment schema under an application-specific
 * table so other company applications can migrate the shared schema without
 * colliding.
 */
export const applyMigrations = Effect.fn("@company/applyMigrations")(
  function* () {
    const database = yield* Database
    yield* Migrator.make({})({
      table: "company_os_migrations",
      loader: Migrator.fromRecord({
        "1_initial": sqlMigration(
          new URL("./migrations/0001_initial.sql", import.meta.url)
        ),
      }),
    }).pipe(Effect.provideService(SqlClient.SqlClient, database.sql))
  }
)
