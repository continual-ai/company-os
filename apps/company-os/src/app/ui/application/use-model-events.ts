import { Effect, Stream } from "effect"
import { useEffect } from "react"

import { EnabledModel } from "#/app.model.ts"
import { listEvents, subscribeEvents } from "#/app/app-client.ts"
import { createEventConsumer } from "#/app/event-consumer.ts"
import { modelData } from "#/runtime/client/data-client.ts"
import { InvalidEventCursor } from "#/runtime/client/events.ts"
import { applyEventPage } from "#/runtime/client/model-cache.ts"
import { runClientEffect } from "#/runtime/client/model-query-client.ts"

/** A single resumable feed per authenticated shell. Hidden tabs catch up on return. */
export function useModelEvents(identity: string, initialCursor?: string) {
  useEffect(() => {
    let disposed = false
    let connection: AbortController | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let failures = 0
    const consumer = createEventConsumer({
      initialCursor,
      read: (cursor, signal) =>
        runClientEffect(listEvents({ cursor, pageSize: 200 }), signal),
      isInvalidCursor: (error) => error instanceof InvalidEventCursor,
      apply: (page) =>
        applyEventPage(modelData().queryClient, page, EnabledModel),
    })
    const connect = async () => {
      if (
        disposed ||
        connection ||
        document.visibilityState === "hidden" ||
        !navigator.onLine
      )
        return
      const current = new AbortController()
      connection = current
      try {
        // Pull also provides recovery on hosts that buffer or do not support SSE.
        while (await consumer.poll(current.signal)) {
          if (current.signal.aborted) return
        }
        await runClientEffect(
          subscribeEvents(consumer.cursor).pipe(
            Effect.flatMap((stream) =>
              stream.pipe(
                Stream.runForEach((message) =>
                  Effect.promise(async () => {
                    await consumer.apply(message.data, current.signal)
                    failures = 0
                  })
                )
              )
            )
          ),
          current.signal
        )
        failures = 0
      } catch (error) {
        if (error instanceof InvalidEventCursor) consumer.restart()
        if (!current.signal.aborted) failures++
      } finally {
        if (connection === current) connection = undefined
        if (!disposed)
          timer = setTimeout(
            () => void connect(),
            Math.min(30_000, 1_000 * 2 ** Math.min(failures, 5))
          )
      }
    }
    const wake = () => {
      if (timer !== undefined) clearTimeout(timer)
      if (document.visibilityState === "hidden" || !navigator.onLine)
        connection?.abort()
      else void connect()
    }
    document.addEventListener("visibilitychange", wake)
    window.addEventListener("online", wake)
    window.addEventListener("offline", wake)
    wake()
    return () => {
      disposed = true
      connection?.abort()
      if (timer !== undefined) clearTimeout(timer)
      document.removeEventListener("visibilitychange", wake)
      window.removeEventListener("online", wake)
      window.removeEventListener("offline", wake)
    }
  }, [identity, initialCursor])
}
