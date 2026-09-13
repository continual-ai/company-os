import { Effect, Stream } from "effect"
import { useEffect, useState } from "react"

import { client } from "#/app/app-client.ts"
import { createChangeConsumer } from "#/app/client/change-consumer.ts"
import { runClientEffect } from "#/runtime/client/create-client.ts"
import { modelData, applyChanges } from "#/runtime/client/model-cache.ts"
import { InvalidEventCursor } from "#/runtime/contract/events.ts"
import { isApiError } from "#/runtime/model/index.ts"

/** A single resumable feed per authenticated shell. Hidden tabs catch up on return. */
export function useModelChanges(identity: string, initialCursor?: string) {
  const [status, setStatus] = useState<
    "connecting" | "live" | "reconnecting" | "offline"
  >("connecting")
  useEffect(() => {
    let disposed = false
    let connection: AbortController | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let failures = 0
    const consumer = createChangeConsumer({
      initialCursor,
      read: (cursor, signal) =>
        runClientEffect(client.changes.list({ cursor }), signal),
      isInvalidCursor: (error) => error instanceof InvalidEventCursor,
      apply: (page) => applyChanges(modelData().queryClient, page),
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
        if (!current.signal.aborted) setStatus("live")
        await runClientEffect(
          client.changes.stream(consumer.cursor).pipe(
            Effect.flatMap((stream) =>
              stream.pipe(
                Stream.runForEach((message) =>
                  Effect.promise(async () => {
                    await consumer.apply(message.data, current.signal)
                    if (!current.signal.aborted) setStatus("live")
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
        if (!current.signal.aborted) {
          if (
            isApiError(error) &&
            (error.status === "UNAUTHENTICATED" ||
              error.status === "PERMISSION_DENIED")
          )
            modelData().reset()
          failures++
          setStatus(navigator.onLine ? "reconnecting" : "offline")
        }
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
      if (!navigator.onLine) setStatus("offline")
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
  return status
}
