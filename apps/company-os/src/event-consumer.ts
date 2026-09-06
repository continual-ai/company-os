import type { EventPage } from "./events"

/** A resumable pull consumer. Advance only after apply succeeds; restart from the last acknowledged cursor. */
export function createEventConsumer(options: {
  readonly read: (cursor: string, signal: AbortSignal) => Promise<EventPage>
  readonly apply: (page: EventPage) => void | Promise<void>
  readonly isInvalidCursor: (error: unknown) => boolean
}) {
  let cursor = "now"
  return {
    poll: async (signal: AbortSignal) => {
      try {
        const page = await options.read(cursor, signal)
        if (signal.aborted) return false
        await options.apply(page)
        if (!signal.aborted) cursor = page.nextCursor
        return page.hasMore
      } catch (error) {
        if (options.isInvalidCursor(error)) cursor = "now"
        throw error
      }
    },
  }
}
