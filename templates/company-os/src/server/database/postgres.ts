import { PgClient } from "@effect/sql-pg"
import { Config } from "effect"

/** Production PostgreSQL services used by repositories at the composition root. */
export const layer = PgClient.layerConfig({
  applicationName: Config.string("APP_NAMESPACE").pipe(
    Config.withDefault("company-os")
  ),
  connectTimeout: Config.succeed("5 seconds"),
  maxConnections: Config.succeed(10),
  url: Config.redacted("DATABASE_URL"),
})
