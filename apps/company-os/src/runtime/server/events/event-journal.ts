import { createHash } from "node:crypto"

import { Context, Effect, Layer, Schema } from "effect"

import {
  eventPageSchema,
  InvalidEventCursor,
} from "#/runtime/contract/events.ts"
import { PageToken } from "#/runtime/model/index.ts"
import { requireProjectAccess } from "#/runtime/server/auth/project-access.ts"
import { makeEventWriter } from "#/runtime/server/events/event-writer.ts"
import { CurrentInvocation } from "#/runtime/server/invocation.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"
import { PageTokens } from "#/runtime/server/page-tokens.ts"
import { Database } from "#/runtime/server/storage/database.ts"
import {
  tableProjection,
  type TableRow,
} from "#/runtime/server/storage/index.ts"
import {
  eventJournal,
  eventJournalState,
} from "#/runtime/server/storage/infrastructure.ts"

const cursorSchema = Schema.Struct({
  kind: Schema.Literal("events.v2"),
  position: Schema.String.check(Schema.isPattern(/^\d+$/)),
  actor: Schema.String,
  model: Schema.String,
  type: Schema.NullOr(Schema.String),
})

const make = Effect.gen(function* () {
  const context = yield* ModelContext

  const database = yield* Database
  const sql = database.sql
  const tokens = yield* PageTokens
  const writer = makeEventWriter(database, context)

  const list = Effect.fn("@company/EventJournal.list")(function* (
    input: {
      readonly cursor?: string | undefined
      readonly type?: string | undefined
      readonly pageSize?: number | undefined
    } = {}
  ) {
    yield* requireProjectAccess
    const invocation = yield* CurrentInvocation
    const size = input.pageSize ?? 100
    if (!Number.isInteger(size) || size < 1 || size > 500)
      return yield* Effect.fail(
        new InvalidEventCursor({
          message: "pageSize must be between 1 and 500.",
        })
      )
    return yield* database.transaction(
      () =>
        Effect.gen(function* () {
          const types = new Set(Object.keys(context.model.objects))
          const fingerprint = createHash("sha256")
            .update(JSON.stringify([...types].sort()))
            .digest("hex")
          const actor = invocation.actorId
          const [state] = yield* sql<
            TableRow<typeof eventJournalState>
          >`select ${tableProjection(eventJournalState)}
          from ${eventJournalState}
          where ${eventJournalState.columns.id} = ${1}`
          if (state === undefined)
            return yield* Effect.die("Event journal state is missing.")
          let position = input.cursor === "now" ? state.position : 0n
          let reset = input.cursor === "now"
          if (input.cursor !== undefined && input.cursor !== "now") {
            const cursor = yield* Effect.try({
              try: () => JSON.parse(tokens.decode(PageToken(input.cursor!))),
              catch: () =>
                new InvalidEventCursor({
                  message:
                    "The event cursor is invalid. Obtain a new cursor and reload data.",
                }),
            }).pipe(
              Effect.flatMap(Schema.decodeUnknownEffect(cursorSchema)),
              Effect.mapError(
                () =>
                  new InvalidEventCursor({
                    message:
                      "The event cursor is invalid. Obtain a new cursor and reload data.",
                  })
              )
            )
            if (
              cursor.actor !== actor ||
              cursor.type !== (input.type ?? null) ||
              BigInt(cursor.position) > state.position
            )
              return yield* Effect.fail(
                new InvalidEventCursor({
                  message:
                    "The event cursor does not match this caller or feed.",
                })
              )
            position = BigInt(cursor.position)
            reset = cursor.model !== fingerprint
          }
          // Bound scanned rows, not just visible rows. Empty pages can still advance the cursor.
          const rows = yield* sql<
            TableRow<typeof eventJournal>
          >`select ${tableProjection(eventJournal)}
          from ${eventJournal}
          where ${sql.and(
            [
              sql`${eventJournal.columns.position} > ${position}`,
              sql`${eventJournal.columns.position} <= ${state.position}`,
              input.type === undefined
                ? undefined
                : sql`${eventJournal.columns.type} = ${input.type}`,
            ].filter((part) => part !== undefined)
          )}
          order by ${sql.csv([eventJournal.columns.position])}
          limit ${size + 1}`
          const hasMore = rows.length > size
          const page = rows.slice(0, size)
          const items = page
            .filter(
              (event) =>
                event.subjects.length > 0 &&
                event.subjects.every((subject) => types.has(subject.objectType))
            )
            .map(({ position: _position, subjects, ...event }) => ({
              ...event,
              subjects: subjects.map(({ id, objectType }) => ({
                id,
                objectType,
              })),
            }))
          const nextPosition = hasMore ? page.at(-1)!.position : state.position
          return yield* Schema.decodeUnknownEffect(eventPageSchema)({
            items,
            hasMore,
            reset,
            nextCursor: tokens.encode(
              JSON.stringify({
                kind: "events.v2",
                position: String(nextPosition),
                actor,
                model: fingerprint,
                type: input.type ?? null,
              })
            ),
          })
        }),
      { isolationLevel: "repeatable read", accessMode: "read only" }
    )
  })
  return { append: writer.append, list }
})

/** App-owned journal. Its persistence shares Database transactions; consumers never execute on append. */
export class EventJournal extends Context.Service<EventJournal>()(
  "@company/EventJournal",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
