import { sql } from "drizzle-orm"
import { Context, Effect, Layer } from "effect"

import { Database } from "./database/database"

const make = Effect.gen(function* () {
  const database = yield* Database
  return {
    check: Effect.fn("@company/Readiness.check")(function* () {
      yield* database.execute(sql`select 1`)
    }),
  }
})

/** Verifies dependencies required to serve authenticated application traffic. */
export class Readiness extends Context.Service<Readiness>()(
  "@company/Readiness",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
