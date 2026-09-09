import { PgClient } from "@effect/sql-pg"
import { Context, Effect, Layer } from "effect"
import type { SqlError } from "effect/unstable/sql/SqlError"

import {
  type PendingEvent,
  PendingEvents,
} from "#/runtime/server/events/event-buffer.ts"
import { flushEvents } from "#/runtime/server/events/flush-events.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"
import { CommittedChanges } from "#/runtime/server/storage/committed-changes.ts"
import { updateSearchIndex } from "#/runtime/server/storage/search-index.ts"

interface TransactionOptions {
  readonly isolationLevel?:
    | "read committed"
    | "repeatable read"
    | "serializable"
  readonly accessMode?: "read only" | "read write"
}

/**
 * PostgreSQL access shared by every server capability. Effect binds the
 * transaction connection through fiber context, so the same `sql` client is
 * valid inside and outside `transaction`.
 */
export interface PostgresDatabase {
  readonly sql: PgClient.PgClient
  /**
   * Runs `body` in one PostgreSQL transaction. A call made while a transaction
   * is already active joins it: no savepoint is opened and its events stage into
   * the same buffer. An uncaught failure fails the enclosing transaction; a
   * caller that catches an inner failure keeps the writes made before it, so
   * "try, recover, continue" flows need an explicit rollback strategy. Options
   * apply only to the call that opens the transaction.
   */
  readonly transaction: <A, E, R>(
    body: (database: PostgresDatabase) => Effect.Effect<A, E, R>,
    options?: TransactionOptions
  ) => Effect.Effect<A, E | SqlError, R>
}

const make = Effect.gen(function* () {
  const context = yield* ModelContext
  const sql = yield* PgClient.PgClient
  const database: PostgresDatabase = {
    sql,
    transaction: (body, options) =>
      Effect.gen(function* () {
        // A pending buffer exists exactly while this fiber runs inside a transaction opened here.
        const enclosing = yield* PendingEvents
        if (enclosing !== undefined) return yield* body(database)
        const events: Array<PendingEvent> = []
        const result = yield* sql.withTransaction(
          Effect.gen(function* () {
            if (options?.isolationLevel)
              yield* sql`set transaction isolation level ${sql.literal(options.isolationLevel)}`
            if (options?.accessMode)
              yield* sql`set transaction ${sql.literal(options.accessMode)}`
            const value = yield* body(database)
            yield* updateSearchIndex(
              database,
              events.flatMap((event) => event.subjects),
              context
            )
            yield* flushEvents(database, events)
            return value
          }).pipe(Effect.provideService(PendingEvents, events))
        )
        // Only the committing transaction knows which facts were durably written.
        const changes = yield* CommittedChanges
        for (const event of events)
          for (const subject of event.subjects) changes?.add(subject.objectType)
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
