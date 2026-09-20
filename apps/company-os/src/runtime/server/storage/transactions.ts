import { PgClient } from "@effect/sql-pg"
import { Context, Effect, Layer, Predicate } from "effect"
import { isSqlError, type SqlError } from "effect/unstable/sql/SqlError"

import {
  ObjectUniqueConflict,
  ObjectCheckFailed,
} from "#/runtime/server/errors.ts"
import {
  type PendingEvent,
  type EventSubject,
  PendingEvents,
} from "#/runtime/server/events/event-buffer.ts"
import { flushEvents } from "#/runtime/server/events/flush-events.ts"
import {
  FinalSnapshots,
  resolveRecordSnapshots,
} from "#/runtime/server/events/record-snapshots.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"
import { CommittedChanges } from "#/runtime/server/storage/committed-changes.ts"
import { objectUniqueConstraintName } from "#/runtime/server/storage/schema.ts"
import { updateSearchIndex } from "#/runtime/server/storage/search-index.ts"
import { tableName } from "#/runtime/server/storage/table.ts"

interface TransactionOptions {
  readonly isolationLevel?:
    | "read committed"
    | "repeatable read"
    | "serializable"
  readonly accessMode?: "read only" | "read write"
}

const TransactionAccessMode = Context.Reference<"read only" | "read write">(
  "@company/TransactionAccessMode",
  { defaultValue: () => "read write" }
)

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
   * apply only to the call that opens the transaction. An explicit access mode
   * must agree with the enclosing transaction; a Query cannot inherit write access.
   * `finalize` assembles the operation response after final snapshots and before journal flush.
   * It must only read. Nested calls resolve immediately so Action code can use their results.
   */
  readonly transaction: <A, E, R, B = A, E2 = never, R2 = never>(
    body: (database: PostgresDatabase) => Effect.Effect<A, E, R>,
    options?: TransactionOptions,
    finalize?: (value: A) => Effect.Effect<B, E2, R2>
  ) => Effect.Effect<
    A | B,
    E | E2 | SqlError | ObjectUniqueConflict | ObjectCheckFailed,
    R | Exclude<R2, FinalSnapshots>
  >
}

const make = Effect.gen(function* () {
  const context = yield* ModelContext
  const sql = yield* PgClient.PgClient
  const linkEvents = new Set(
    Object.keys(context.model.links).flatMap((id) => [
      `${id}.linked`,
      `${id}.unlinked`,
    ])
  )
  const uniqueConstraints = new Map(
    Object.values(context.model.objects).flatMap((object) =>
      Object.entries(object.uniqueBy).map(
        ([rule, fields]) =>
          [
            objectUniqueConstraintName(tableName(context.table(object)), rule),
            { objectType: object.id, rule, fields },
          ] as const
      )
    )
  )
  const checks = new Map<
    string,
    {
      objectType: string
      rule: string
      fields: ReadonlyArray<string>
      message: string
    }
  >(
    Object.values(context.model.objects).flatMap((object) =>
      Object.entries(object.checks).map(
        ([rule, check]) =>
          [
            `${tableName(context.table(object))}_check_${rule}`,
            {
              objectType: object.id,
              rule,
              fields: [check.left, check.right],
              message: check.message,
            },
          ] as const
      )
    )
  )
  const database: PostgresDatabase = {
    sql,
    transaction: (body, options, finalize) =>
      Effect.gen(function* () {
        // A pending buffer exists exactly while this fiber runs inside a transaction opened here.
        const enclosing = yield* PendingEvents
        if (enclosing !== undefined) {
          if (
            options?.accessMode !== undefined &&
            options.accessMode !== (yield* TransactionAccessMode)
          )
            return yield* Effect.die(
              "Cannot change access mode inside an open transaction. Read through database.repository(Object) inside an Action; invoke Queries outside its write transaction."
            )
          const value = yield* body(database)
          return finalize
            ? yield* finalize(value).pipe(
                Effect.provideService(FinalSnapshots, FinalSnapshots.make())
              )
            : value
        }
        const events: Array<PendingEvent> = []
        const result = yield* sql.withTransaction(
          Effect.gen(function* () {
            if (options?.isolationLevel)
              yield* sql`set transaction isolation level ${sql.literal(options.isolationLevel)}`
            if (options?.accessMode)
              yield* sql`set transaction ${sql.literal(options.accessMode)}`
            // Each writer owns its constraint validation even inside an outer SQL migration transaction.
            if (options?.accessMode !== "read only")
              yield* sql`set constraints all deferred`
            const value = yield* body(database)
            // Validate deferred constraints as typed failures before the driver commits.
            yield* sql`set constraints all immediate`
            const records: EventSubject[] = []
            const relationships: EventSubject[] = []
            for (const event of events)
              (linkEvents.has(event.type) ? relationships : records).push(
                ...event.subjects
              )
            yield* updateSearchIndex(
              database,
              { records, relationships },
              context
            )
            const response = yield* Effect.gen(function* () {
              yield* resolveRecordSnapshots(events, context.eventFactSchema)
              return finalize ? yield* finalize(value) : value
            }).pipe(
              Effect.provideService(FinalSnapshots, FinalSnapshots.make())
            )
            yield* flushEvents(database, events)
            return response
          }).pipe(
            Effect.provideService(PendingEvents, events),
            Effect.provideService(
              TransactionAccessMode,
              options?.accessMode ?? "read write"
            )
          )
        )
        // Only the committing transaction knows which facts were durably written.
        const changes = yield* CommittedChanges
        for (const event of events)
          for (const subject of event.subjects) changes?.add(subject.objectType)
        return result
      }).pipe(
        Effect.mapError((error) => {
          if (isSqlError(error) && error.reason._tag === "ConstraintError") {
            const cause = error.reason.cause
            if (
              Predicate.hasProperty(cause, "constraint") &&
              typeof cause.constraint === "string"
            ) {
              const check = checks.get(cause.constraint)
              if (check) return new ObjectCheckFailed(check)
            }
          }
          if (!isSqlError(error) || error.reason._tag !== "UniqueViolation")
            return error
          const conflict = uniqueConstraints.get(error.reason.constraint)
          return conflict === undefined
            ? error
            : new ObjectUniqueConflict(conflict)
        })
      ),
  }
  return database
})
/** Transactions commit business state, search projections, and journal entries together. */
export class SqlDatabase extends Context.Service<SqlDatabase>()(
  "@company/SqlDatabase",
  {
    make,
  }
) {
  static readonly layer = Layer.effect(this, this.make)
}
