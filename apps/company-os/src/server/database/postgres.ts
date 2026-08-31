import { PgClient } from "@effect/sql-pg"
import { Config, Layer, Redacted } from "effect"

import { Database } from "./database"

const SCHEMA_NAME_PATTERN = /^[a-z_][a-z0-9_]*$/

/**
 * Validates a PostgreSQL schema name before it is embedded in a connection
 * string or DDL. The value crosses a SQL boundary, so anything outside the
 * conservative identifier alphabet is rejected rather than escaped.
 */
export function assertDatabaseSchemaName(schema: string): string {
  if (!SCHEMA_NAME_PATTERN.test(schema)) {
    throw new Error(
      `DATABASE_SCHEMA must match ${SCHEMA_NAME_PATTERN}; received ${JSON.stringify(schema)}.`
    )
  }
  return schema
}

/**
 * Returns a connection URL whose sessions resolve unqualified names in the
 * given schema first. All company applications on a deployment share one
 * business schema, so schema selection happens only here, never in table
 * definitions or queries.
 */
export function withSearchPath(url: string, schema: string): string {
  assertDatabaseSchemaName(schema)
  if (schema === "public") return url
  const parsed = new URL(url)
  const searchPath = `-csearch_path=${schema},public`
  const existing = parsed.searchParams.get("options")
  parsed.searchParams.set(
    "options",
    existing ? `${existing} ${searchPath}` : searchPath
  )
  return parsed.toString()
}

/** Schema that unqualified names resolve to; the deployment platform supplies it, local development defaults to public. */
export const databaseSchemaConfig = Config.string("DATABASE_SCHEMA").pipe(
  Config.withDefault("public"),
  Config.map(assertDatabaseSchemaName)
)

const connectionUrlConfig = Config.all({
  schema: databaseSchemaConfig,
  url: Config.redacted("DATABASE_URL"),
}).pipe(
  Config.map(({ schema, url }) =>
    Redacted.make(withSearchPath(Redacted.value(url), schema))
  )
)

/** Configured PostgreSQL client used to construct the application database. */
const clientLayer = PgClient.layerConfig({
  applicationName: Config.succeed("company-os"),
  connectTimeout: Config.succeed("5 seconds"),
  maxConnections: Config.int("DATABASE_MAX_CONNECTIONS").pipe(
    Config.withDefault(10)
  ),
  url: connectionUrlConfig,
})

/** The application-typed Drizzle database backed by the configured PostgreSQL client. */
export const databaseLayer = Database.layer.pipe(Layer.provide(clientLayer))

/** Raw PostgreSQL and typed Drizzle services used together by database administration commands. */
export const databaseAndClientLayer = Layer.merge(clientLayer, databaseLayer)
