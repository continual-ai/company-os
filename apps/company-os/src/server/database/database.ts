import * as PgDrizzle from "drizzle-orm/effect-postgres"
import { Context, Effect, Layer } from "effect"

import { PendingEvents } from "@/server/events/event-buffer"
import { flushEvents } from "@/server/events/flush-events"

import { CommittedChanges } from "./committed-changes"
import { relations } from "./schema"

function trackTransactions(
  database: PgDrizzle.EffectPgDatabase<typeof relations>
) {
  const original = database.transaction.bind(database)
  database.transaction = (body, config) =>
    Effect.gen(function* () {
      const parent = yield* PendingEvents
      const events: NonNullable<typeof parent> = []
      const result = yield* original(
        (tx) =>
          Effect.gen(function* () {
            trackTransactions(tx)
            const value = yield* body(tx)
            if (parent === undefined) yield* flushEvents(tx, events)
            return value
          }).pipe(Effect.provideService(PendingEvents, events)),
        config
      )
      if (parent !== undefined) parent.push(...events)
      else {
        const changes = yield* CommittedChanges
        for (const event of events)
          for (const subject of event.subjects) changes?.add(subject.objectType)
      }
      return result
    })
}

const make = Effect.gen(function* () {
  const database = yield* PgDrizzle.makeWithDefaults({ relations })
  trackTransactions(database)
  return database
})

/** The application's typed database, backed by the configured Effect PostgreSQL client. */
export class Database extends Context.Service<Database>()("@company/Database", {
  make,
}) {
  static readonly layer = Layer.effect(this, this.make)
}
