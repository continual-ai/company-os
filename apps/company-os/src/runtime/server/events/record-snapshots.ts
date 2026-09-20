import { Context, Effect, Schema } from "effect"

import {
  PendingEvents,
  type PendingEvent,
} from "#/runtime/server/events/event-buffer.ts"
import type { ModelContext } from "#/runtime/server/model-context.ts"

export interface RecordSnapshot {
  readonly id: string
  readonly read: Effect.Effect<object | undefined>
}

/** One instance per completion phase, after business writes have finished. */
export class FinalSnapshots extends Context.Service<
  FinalSnapshots,
  {
    readonly get: <A extends object>(
      id: string,
      read: Effect.Effect<A | undefined>
    ) => Effect.Effect<A | undefined>
  }
>()("@company/FinalSnapshots") {
  static make() {
    const records = new Map<string, object | undefined>()
    return FinalSnapshots.of({
      get: <A extends object>(id: string, read: Effect.Effect<A | undefined>) =>
        Effect.gen(function* () {
          if (!records.has(id)) records.set(id, yield* read)
          // Record IDs identify one concrete model type; every loader returns its normal read shape.
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion
          return records.get(id) as A | undefined
        }),
    })
  }
}

/** Keep pre-delete values for pending facts; a failed deletion still resolves the live record. */
export const preserveRecordSnapshots = Effect.fn("@company/Snapshots.preserve")(
  function* (ids: ReadonlySet<string>) {
    const pending = yield* PendingEvents
    const records = new Map<string, object | undefined>()
    for (const event of pending ?? []) {
      const snapshot = event.snapshot
      if (!snapshot || !ids.has(snapshot.id)) continue
      if (!records.has(snapshot.id))
        records.set(snapshot.id, yield* snapshot.read)
    }
    for (let index = 0; index < (pending?.length ?? 0); index++) {
      const event = pending![index]!
      if (event.snapshot && records.has(event.snapshot.id))
        pending![index] = { ...event, data: records.get(event.snapshot.id) }
    }
  }
)

export const resolveRecordSnapshots = Effect.fn("@company/Snapshots.resolve")(
  function* (
    events: Array<PendingEvent>,
    schema: typeof ModelContext.Service.eventFactSchema
  ) {
    const snapshots = yield* FinalSnapshots
    for (let index = 0; index < events.length; index++) {
      const pending = events[index]!
      if (!pending.snapshot) continue
      const { snapshot, ...event } = pending
      const record = yield* snapshots.get(snapshot.id, snapshot.read)
      const fact = yield* Schema.decodeUnknownEffect(schema)({
        ...event,
        data: record ?? event.data,
      }).pipe(Effect.orDie)
      events[index] = { ...event, data: fact.data }
    }
  }
)
