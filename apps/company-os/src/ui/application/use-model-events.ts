import { Effect } from "effect"
import { useEffect } from "react"

import { listEvents } from "@/app-client"
import { modelData } from "@/data-client"
import { createEventConsumer } from "@/event-consumer"
import { InvalidEventCursor } from "@/events"

/** One consumer per mounted authenticated shell, sharing the existing model cache. */
export function useModelEvents(identity: string) {
  useEffect(() => {
    const abort = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let running = false
    let failures = 0
    const data = modelData()
    const consumer = createEventConsumer({
      read: (cursor, signal) =>
        Effect.runPromise(listEvents({ cursor, pageSize: 200 }), { signal }),
      isInvalidCursor: (error) => error instanceof InvalidEventCursor,
      apply: (page) => {
        if (page.reset) data.reset()
        else
          data.invalidate([
            ...new Set(
              page.items.flatMap((event) =>
                event.subjects.map((subject) => subject.objectType)
              )
            ),
          ])
      },
    })
    const poll = async () => {
      if (running || abort.signal.aborted) return
      if (timer !== undefined) clearTimeout(timer)
      if (document.visibilityState === "hidden" || !navigator.onLine) return
      running = true
      let more = false
      try {
        more = await consumer.poll(abort.signal)
        failures = 0
      } catch {
        failures += 1
      } finally {
        running = false
        if (!abort.signal.aborted)
          timer = setTimeout(
            () => void poll(),
            more ? 0 : Math.min(30_000, 2_000 * 2 ** Math.min(failures, 4))
          )
      }
    }
    const wake = () => {
      void poll()
    }
    document.addEventListener("visibilitychange", wake)
    window.addEventListener("online", wake)
    wake()
    return () => {
      abort.abort()
      if (timer !== undefined) clearTimeout(timer)
      document.removeEventListener("visibilitychange", wake)
      window.removeEventListener("online", wake)
    }
  }, [identity])
}
