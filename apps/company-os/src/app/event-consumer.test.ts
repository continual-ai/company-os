import { describe, expect, it } from "vitest"

import { createEventConsumer } from "#/app/event-consumer.ts"
import type { EventPage } from "#/runtime/client/events.ts"

const page: EventPage = {
  items: [],
  nextCursor: "committed",
  hasMore: false,
  reset: false,
}

describe("event consumer", () => {
  it("retries delivery from its acknowledged cursor after a network or apply failure", async () => {
    const cursors: string[] = []
    let networkFails = false
    let applyFails = true
    const consumer = createEventConsumer({
      read: async (cursor) => {
        cursors.push(cursor)
        if (networkFails) throw new Error("offline")
        return page
      },
      apply: () => {
        if (applyFails) throw new Error("apply failed")
      },
      isInvalidCursor: () => false,
    })
    const signal = new AbortController().signal
    await expect(consumer.poll(signal)).rejects.toThrow("apply failed")
    applyFails = false
    await consumer.poll(signal)
    networkFails = true
    await expect(consumer.poll(signal)).rejects.toThrow("offline")
    networkFails = false
    await consumer.poll(signal)
    expect(cursors).toEqual(["now", "now", "committed", "committed"])
  })
  it("discards an old identity's in-flight response and resets incompatible cursors", async () => {
    const abort = new AbortController()
    let applies = 0
    const consumer = createEventConsumer({
      read: async () => {
        abort.abort()
        return page
      },
      apply: () => {
        applies++
      },
      isInvalidCursor: () => false,
    })
    await consumer.poll(abort.signal)
    expect(applies).toBe(0)
    const cursors: string[] = []
    const resettable = createEventConsumer({
      read: async (cursor) => {
        cursors.push(cursor)
        if (cursors.length === 2) throw new Error("cursor")
        return page
      },
      apply: () => undefined,
      isInvalidCursor: () => true,
    })
    const signal = new AbortController().signal
    await resettable.poll(signal)
    await expect(resettable.poll(signal)).rejects.toThrow("cursor")
    await resettable.poll(signal)
    expect(cursors).toEqual(["now", "committed", "now"])
  })
})
