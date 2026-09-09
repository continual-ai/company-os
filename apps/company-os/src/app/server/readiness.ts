import { Context, Effect, Layer } from "effect"

import { Database } from "#/runtime/server/storage/database.ts"

const make = Effect.gen(function* () {
  const database = yield* Database
  const sql = database.sql
  return {
    check: Effect.fn("@company/Readiness.check")(function* () {
      yield* sql`select 1`
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
