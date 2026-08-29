import { PgClient } from "@effect/sql-pg"
import { Config, Layer } from "effect"

import { Database } from "./database"

/** Configured PostgreSQL client used to construct the application database. */
const clientLayer = PgClient.layerConfig({
  applicationName: Config.string("APP_NAMESPACE").pipe(
    Config.withDefault("company-os")
  ),
  connectTimeout: Config.succeed("5 seconds"),
  maxConnections: Config.succeed(10),
  url: Config.redacted("DATABASE_URL"),
})

/** The application-typed Drizzle database backed by the configured PostgreSQL client. */
export const databaseLayer = Database.layer.pipe(Layer.provide(clientLayer))

/** Raw PostgreSQL and typed Drizzle services used together by database administration commands. */
export const databaseAndClientLayer = Layer.merge(clientLayer, databaseLayer)
