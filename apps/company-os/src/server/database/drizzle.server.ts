import * as PgDrizzle from "drizzle-orm/effect-postgres"
import { Context, Effect, Layer } from "effect"
import type { SqlError } from "effect/unstable/sql/SqlError"

const make = PgDrizzle.makeWithDefaults()

/** Acme's typed physical database, backed by the configured Effect PostgreSQL client. */
export class Database extends Context.Service<Database>()("@acme/Database", {
  make,
}) {
  static readonly layer = Layer.effect(this, this.make)

  /** Runs all database work in the Effect on one atomic PostgreSQL transaction. */
  static transaction<A, E, R>(
    effect: Effect.Effect<A, E, R>
  ): Effect.Effect<A, E | SqlError, Database | R> {
    return Effect.gen(function* () {
      const database = yield* Database
      return yield* database.transaction(() => effect)
    })
  }
}
