import { PgClient } from "@effect/sql-pg"
import { Context, Effect, Layer } from "effect"

import { CommittedChanges } from "#/runtime/server/database/committed-changes.ts"
import { updateSearchIndex } from "#/runtime/server/database/search-index.ts"
import { PendingEvents } from "#/runtime/server/events/event-buffer.ts"
import { flushEvents } from "#/runtime/server/events/flush-events.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"
import type { PostgresDatabase } from "#/runtime/server/postgres/index.ts"

const make = Effect.gen(function* () {
  const context = yield* ModelContext
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
                events.flatMap((event) => event.subjects),
                context
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
