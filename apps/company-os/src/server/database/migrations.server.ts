import { fileURLToPath } from "node:url"

import { migrate } from "drizzle-orm/effect-postgres/migrator"
import { Effect } from "effect"

import { Database } from "./database.server"

const migrationsFolder = fileURLToPath(new URL("./migrations", import.meta.url))

/** Applies the committed, forward-only database migration history. */
export const applyMigrations = Effect.fn("@company/applyMigrations")(
  function* () {
    const database = yield* Database
    yield* migrate(database, { migrationsFolder })
  }
)
