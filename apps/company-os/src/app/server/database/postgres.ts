import { PgClient } from "@effect/sql-pg"
import { Config, Layer, Redacted } from "effect"

import { Model } from "#/app.model.ts"
import { EventNotifications } from "#/runtime/server/events/event-notifications.ts"
import { foundationLayer } from "#/runtime/server/foundation.ts"
import { pgTypes } from "#/runtime/server/storage/index.ts"

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
 * given schema first. All account applications on a deployment share one
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
export const databaseSchemaConfig = Config.String("DATABASE_SCHEMA").pipe(
  Config.withDefault("public"),
  Config.map(assertDatabaseSchemaName)
)

const connectionUrlConfig = Config.all({
  schema: databaseSchemaConfig,
  url: Config.Redacted("DATABASE_URL"),
}).pipe(
  Config.map(({ schema, url }) =>
    Redacted.make(withSearchPath(Redacted.value(url), schema))
  )
)

/** Configured PostgreSQL client used to construct the application database. */
export const sqlLayer = PgClient.layerConfig({
  types: Config.succeed(pgTypes),
  applicationName: Config.succeed("company-os"),
  connectTimeout: Config.succeed("5 seconds"),
  maxConnections: Config.Int("DATABASE_MAX_CONNECTIONS").pipe(
    Config.withDefault(2)
  ),
  url: connectionUrlConfig,
})

/** The application-typed Effect SQL database backed by the configured PostgreSQL client. */
export const databaseLayer = foundationLayer(Model, { sql: sqlLayer })

export const eventNotificationsLayer = EventNotifications.layer.pipe(
  Layer.provide(sqlLayer)
)
