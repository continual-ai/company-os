import { createHash } from "node:crypto"

import { PageToken } from "@company/runtime"
import { CurrentInvocation } from "@company/runtime/effect/object-service"
import { and, eq, gt, inArray, lte } from "drizzle-orm"
import { Context, Effect, Layer, Schema } from "effect"

import { eventPageSchema, InvalidEventCursor } from "@/events"
import { Authorization } from "@/server/authorization/authorization-service"
import { Database } from "@/server/database/database"
import {
  eventJournal,
  eventJournalState,
  objects,
} from "@/server/database/schema"
import { PageTokens } from "@/server/page-tokens"

import { makeEventWriter } from "./event-writer"

const cursorSchema = Schema.Struct({
  kind: Schema.Literal("events.v1"),
  position: Schema.String.check(Schema.isPattern(/^\d+$/)),
  actor: Schema.String,
  authorization: Schema.String,
  type: Schema.NullOr(Schema.String),
})

const make = Effect.gen(function* () {
  const database = yield* Database
  const authorization = yield* Authorization
  const tokens = yield* PageTokens
  const writer = makeEventWriter(database)

  const list = Effect.fn("@company/EventJournal.list")(function* (
    input: {
      readonly cursor?: string | undefined
      readonly type?: string | undefined
      readonly pageSize?: number | undefined
    } = {}
  ) {
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
          const scopes = yield* authorization.readableScopes()
          const fingerprint = createHash("sha256")
            .update(JSON.stringify(scopes))
            .digest("hex")
          const actor = JSON.stringify([
            invocation.actorId,
            invocation.authorizationActorId,
          ])
          const [state] = yield* database
            .select()
            .from(eventJournalState)
            .where(eq(eventJournalState.id, 1))
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
            reset = cursor.authorization !== fingerprint
          }
          // Bound scanned rows, not just visible rows. Empty pages can still advance the cursor.
          const rows = yield* database
            .select()
            .from(eventJournal)
            .where(
              and(
                gt(eventJournal.position, position),
                lte(eventJournal.position, state.position),
                input.type === undefined
                  ? undefined
                  : eq(eventJournal.type, input.type)
              )
            )
            .orderBy(eventJournal.position)
            .limit(size + 1)
          const hasMore = rows.length > size
          const page = rows.slice(0, size)
          const ids = [
            ...new Set(
              page.flatMap((event) => event.subjects.map((target) => target.id))
            ),
          ]
          const current =
            ids.length === 0
              ? []
              : yield* database
                  .select({
                    id: objects.id,
                    ancestorIds: objects.ancestorIds,
                    objectType: objects.objectType,
                  })
                  .from(objects)
                  .where(inArray(objects.id, ids))
          const byId = new Map(current.map((target) => [target.id, target]))
          const items = page
            .filter(
              (event) =>
                event.subjects.length > 0 &&
                event.subjects.every((historical) => {
                  const live = byId.get(historical.id)
                  if (
                    live !== undefined &&
                    live.objectType !== historical.objectType
                  )
                    return false
                  const target = live ?? historical
                  const allowed = scopes[target.objectType] ?? []
                  return (
                    allowed.includes(target.id) ||
                    target.ancestorIds.some((id) => allowed.includes(id))
                  )
                })
            )
            .map(({ position: _position, subjects, ...event }) => ({
              ...event,
              subjects: subjects.map(
                ({ ancestorIds: _ancestors, ...target }) => target
              ),
            }))
          const nextPosition = hasMore ? page.at(-1)!.position : state.position
          return yield* Schema.decodeUnknownEffect(eventPageSchema)({
            items,
            hasMore,
            reset,
            nextCursor: tokens.encode(
              JSON.stringify({
                kind: "events.v1",
                position: String(nextPosition),
                actor,
                authorization: fingerprint,
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
