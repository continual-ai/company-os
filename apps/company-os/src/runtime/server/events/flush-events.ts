import { randomUUID } from "node:crypto"

import { Effect } from "effect"
import { SqlError, UnknownError } from "effect/unstable/sql/SqlError"

import type { PendingEvent } from "#/runtime/server/events/event-buffer.ts"
import { assignments, insertValues } from "#/runtime/server/storage/index.ts"
import {
  tableProjection,
  type TableRow,
  type PostgresDatabase,
} from "#/runtime/server/storage/index.ts"
import {
  eventJournal,
  eventJournalState,
} from "#/runtime/server/storage/infrastructure.ts"

/** Last work before COMMIT: no business locks or external effects may follow position allocation. */
export const flushEvents = (
  database: PostgresDatabase,
  events: ReadonlyArray<PendingEvent>
) =>
  Effect.gen(function* () {
    const sql = database.sql

    if (events.length === 0) return undefined
    const [state] = yield* sql<
      TableRow<typeof eventJournalState>
    >`update ${eventJournalState} set ${assignments(sql, eventJournalState, { position: sql`${eventJournalState.columns.position} + ${events.length}` })}
          where ${eventJournalState.columns.id} = ${1}
          returning ${tableProjection(eventJournalState)}`
    if (state === undefined)
      return yield* Effect.die(
        "Event journal state is missing. Apply database migrations."
      )
    const first = state.position - BigInt(events.length) + 1n
    const transactionId = randomUUID()
    // Chunk large transactions without releasing the sequencing lock.
    for (let offset = 0; offset < events.length; offset += 500) {
      yield* sql`insert into ${eventJournal} ${insertValues(
        sql,
        eventJournal,
        events.slice(offset, offset + 500).map((event, index) => ({
          ...event,
          subjects: [...event.subjects],
          position: first + BigInt(offset + index),
          transactionId,
        }))
      )}`
    }
    // Execute on the transaction connection; PostgreSQL delivers only after COMMIT.
    yield* sql`select pg_notify('company_events', 'changed')`
    return undefined
  }).pipe(
    Effect.mapError(
      (cause) =>
        new SqlError({
          reason: new UnknownError({
            cause,
            message: "Could not persist the transaction's events.",
          }),
        })
    )
  )
