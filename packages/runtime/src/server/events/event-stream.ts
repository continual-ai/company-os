import { Effect, Stream } from "effect"

import type { EventPage } from "#/client/events.ts"
import { EventNotifications } from "#/server/events/event-notifications.ts"

/** Subscribe before reading; drain pages in order and recheck access even when idle. */
export function streamEvents<E>(
  read: (cursor: string) => Effect.Effect<EventPage, E>,
  initialCursor: string
) {
  return Stream.unwrap(
    Effect.gen(function* () {
      const notifications = yield* EventNotifications
      const wake = yield* notifications.subscribe
      let cursor = initialCursor
      let more = true
      return Stream.fromEffectRepeat(
        Effect.gen(function* () {
          if (!more) yield* Effect.raceFirst(wake, Effect.sleep("15 seconds"))
          const page = yield* read(cursor)
          cursor = page.nextCursor
          more = page.hasMore
          return { id: page.nextCursor, event: "page" as const, data: page }
        })
      ).pipe(Stream.interruptWhen(Effect.sleep("60 seconds")))
    })
  )
}
