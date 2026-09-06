import { randomUUID } from "node:crypto"

import { eq, sql } from "drizzle-orm"
import type { AnyRelations } from "drizzle-orm"
import type { EffectPgDatabase } from "drizzle-orm/effect-postgres"
import { Effect } from "effect"
import { SqlError, UnknownError } from "effect/unstable/sql/SqlError"

import { eventJournal, eventJournalState } from "@/server/database/schema"

import type { PendingEvent } from "./event-buffer"

/** Last work before COMMIT: no business locks or external effects may follow position allocation. */
export const flushEvents = <R extends AnyRelations>(
  database: EffectPgDatabase<R>,
  events: ReadonlyArray<PendingEvent>
) =>
  Effect.gen(function* () {
    if (events.length === 0) return undefined
    const [state] = yield* database
      .update(eventJournalState)
      .set({ position: sql`${eventJournalState.position} + ${events.length}` })
      .where(eq(eventJournalState.id, 1))
      .returning()
    if (state === undefined)
      return yield* Effect.die(
        "Event journal state is missing. Apply database migrations."
      )
    const first = state.position - BigInt(events.length) + 1n
    const transactionId = randomUUID()
    // Chunk large transactions without releasing the sequencing lock.
    for (let offset = 0; offset < events.length; offset += 500) {
      yield* database.insert(eventJournal).values(
        events.slice(offset, offset + 500).map((event, index) => ({
          ...event,
          subjects: [...event.subjects],
          position: first + BigInt(offset + index),
          transactionId,
        }))
      )
    }
    // Execute on the transaction connection; PostgreSQL delivers only after COMMIT.
    yield* database.execute(sql`select pg_notify('company_events', 'changed')`)
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
