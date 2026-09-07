import type { PostgresDatabase } from "@company/postgres"
import { PgClient } from "@effect/sql-pg"
import { Context, Effect, Layer } from "effect"

import { PendingEvents } from "@/server/events/event-buffer"
import { flushEvents } from "@/server/events/flush-events"

import { CommittedChanges } from "./committed-changes"
import { updateSearchIndex } from "./search-index"

const make = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient
  const database: PostgresDatabase = {
    sql,
    transaction: (body, config) =>
      Effect.gen(function* () {
        const parent = yield* PendingEvents
        const events: NonNullable<typeof parent> = []
        const result = yield* sql.withTransaction(
          Effect.gen(function* () {
            if (config?.isolationLevel)
              yield* sql`set transaction isolation level ${sql.literal(config.isolationLevel)}`
            if (config?.accessMode)
              yield* sql`set transaction ${sql.literal(config.accessMode)}`
            const value = yield* body(database)
            if (parent === undefined) {
              yield* updateSearchIndex(
                database,
                events.flatMap((event) => event.subjects)
              )
              yield* flushEvents(database, events)
            }
            return value
          }).pipe(Effect.provideService(PendingEvents, events))
        )
        if (parent !== undefined) parent.push(...events)
        else {
          const changes = yield* CommittedChanges
          for (const event of events)
            for (const subject of event.subjects)
              changes?.add(subject.objectType)
        }
        return result
      }),
  }
  return database
})
/** Transactions commit business state, search projections, and journal entries together. */
export class Database extends Context.Service<Database>()("@company/Database", {
  make,
}) {
  static readonly layer = Layer.effect(this, this.make)
}
