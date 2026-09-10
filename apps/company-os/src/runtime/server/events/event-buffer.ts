import { Context, Effect } from "effect"

export interface EventSubject {
  readonly id: string
  readonly objectType: string
}

export interface PendingEvent {
  readonly id: string
  readonly type: string
  readonly version: number
  readonly subjects: ReadonlyArray<EventSubject>
  readonly actorId: string
  readonly data: unknown
  readonly occurredAt: string
}

/** A buffer is scoped to one open database transaction, never to an HTTP request. */
export const PendingEvents = Context.Reference<Array<PendingEvent> | undefined>(
  "@company/PendingEvents",
  { defaultValue: () => undefined }
)

export const stageEvent = Effect.fn("@company/stageEvent")(function* (
  event: PendingEvent
) {
  const pending = yield* PendingEvents
  if (pending === undefined)
    return yield* Effect.die(
      "Events must be appended inside Database.transaction."
    )
  pending.push(event)
  return undefined
})
