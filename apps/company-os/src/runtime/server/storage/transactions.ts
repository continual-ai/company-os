import { PgClient } from "@effect/sql-pg"
import { Context, Effect, Layer, Predicate } from "effect"
import { isSqlError, type SqlError } from "effect/unstable/sql/SqlError"

import {
  ObjectUniqueConflict,
  ObjectCheckFailed,
} from "#/runtime/server/errors.ts"
import {
  type PendingEvent,
  PendingEvents,
} from "#/runtime/server/events/event-buffer.ts"
import { flushEvents } from "#/runtime/server/events/flush-events.ts"
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
   */
  readonly transaction: <A, E, R>(
    body: (database: PostgresDatabase) => Effect.Effect<A, E, R>,
    options?: TransactionOptions
  ) => Effect.Effect<
    A,
    E | SqlError | ObjectUniqueConflict | ObjectCheckFailed,
    R
  >
}

const make = Effect.gen(function* () {
  const context = yield* ModelContext
  const sql = yield* PgClient.PgClient
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
    transaction: (body, options) =>
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
          return yield* body(database)
        }
        const events: Array<PendingEvent> = []
        const result = yield* sql.withTransaction(
          Effect.gen(function* () {
            if (options?.isolationLevel)
              yield* sql`set transaction isolation level ${sql.literal(options.isolationLevel)}`
            if (options?.accessMode)
              yield* sql`set transaction ${sql.literal(options.accessMode)}`
            // Each writer owns its graph validation even inside an outer SQL migration transaction.
            if (options?.accessMode !== "read only")
              yield* sql`set constraints all deferred`
            const value = yield* body(database)
            // Validate deferred graph constraints as typed failures before the driver commits.
            yield* sql`set constraints all immediate`
            yield* updateSearchIndex(
              database,
              events.flatMap((event) => event.subjects),
              context
            )
            for (let i = 0; i < events.length; i++) {
              const pending = events[i]!
              if (pending.snapshot !== undefined) {
                const { snapshot, ...event } = pending
                events[i] = { ...event, data: yield* snapshot }
              }
            }
            yield* flushEvents(database, events)
            return value
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
