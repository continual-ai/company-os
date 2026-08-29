import type * as PgliteDrizzle from "drizzle-orm/effect-pglite"
import type { Effect } from "effect"

import type { Database } from "./database"
import type { relations } from "./schema"

type PgliteDatabase = Effect.Success<
  ReturnType<typeof PgliteDrizzle.makeWithDefaults<typeof relations>>
>

/** Adapts the in-memory test driver to the production repository interface. */
export function asTestDatabase(
  database: PgliteDatabase
): typeof Database.Service {
  // SAFETY: Effect PostgreSQL and PGlite implement the same Drizzle query and
  // transaction API; tests replace only the underlying client.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return database as unknown as typeof Database.Service
}
