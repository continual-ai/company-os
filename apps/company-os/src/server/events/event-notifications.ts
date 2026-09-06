import { PgClient } from "@effect/sql-pg"
import { Context, Effect, Layer, PubSub, Schedule, Stream } from "effect"

/** Wakeups are disposable; the journal and periodic catch-up provide correctness. */
export class EventNotifications extends Context.Service<EventNotifications>()(
  "@company/EventNotifications",
  {
    make: Effect.gen(function* () {
      const postgres = yield* PgClient.PgClient
      const notifications = yield* PubSub.sliding<void>(1)
      yield* postgres.listen("company_events").pipe(
        // Renew even a silently disconnected listener; durable reads cover every gap.
        Stream.interruptWhen(Effect.sleep("60 seconds")),
        Stream.runForEach(() => PubSub.publish(notifications, undefined)),
        Effect.catchCause((cause) =>
          Effect.logWarning(
            "Event notifications disconnected; journal catch-up remains available",
            cause
          )
        ),
        Effect.repeat(Schedule.spaced("1 second")),
        Effect.forkScoped
      )
      return {
        subscribe: PubSub.subscribe(notifications).pipe(
          Effect.map((subscription) => PubSub.take(subscription))
        ),
      }
    }),
  }
) {
  static readonly layer = Layer.effect(this, this.make)
  /** Hosts without session connections still consume the durable journal. */
  static readonly layerPolling = Layer.succeed(this, {
    subscribe: Effect.succeed(Effect.never),
  })
}
