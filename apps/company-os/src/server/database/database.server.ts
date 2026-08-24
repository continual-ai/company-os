import * as PgDrizzle from "drizzle-orm/effect-postgres"
import { Context, Effect, Layer } from "effect"
import type { SqlError } from "effect/unstable/sql/SqlError"

import { relations } from "./schema.server"

const make = PgDrizzle.makeWithDefaults({ relations })

/** The application's typed database, backed by the configured Effect PostgreSQL client. */
export class Database extends Context.Service<Database>()("@company/Database", {
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
