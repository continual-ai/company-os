import { PgClient } from "@effect/sql-pg"
import { Config, Layer } from "effect"

import { Database } from "./database"

/** Production PostgreSQL services used by repositories at the composition root. */
const clientLayer = PgClient.layerConfig({
  applicationName: Config.string("APP_NAMESPACE").pipe(
    Config.withDefault("company-os")
  ),
  connectTimeout: Config.succeed("5 seconds"),
  maxConnections: Config.succeed(10),
  url: Config.redacted("DATABASE_URL"),
})

export const databaseLayer = Database.layer.pipe(Layer.provide(clientLayer))
export const layer = Layer.merge(clientLayer, databaseLayer)
