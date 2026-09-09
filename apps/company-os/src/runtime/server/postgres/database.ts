import type { PgClient } from "@effect/sql-pg"
import type { Effect } from "effect"
import type { SqlError } from "effect/unstable/sql/SqlError"

/** A transaction carries the same SQL client; Effect binds its connection through fiber context. */
export interface PostgresDatabase {
  readonly sql: PgClient.PgClient
  readonly transaction: <A, E, R>(
    body: (database: PostgresDatabase) => Effect.Effect<A, E, R>,
    options?: {
      readonly isolationLevel?:
        | "read committed"
        | "repeatable read"
        | "serializable"
      readonly accessMode?: "read only" | "read write"
    }
  ) => Effect.Effect<A, E | SqlError, R>
}
