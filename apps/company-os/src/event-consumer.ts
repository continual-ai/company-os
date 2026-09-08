import type { EventPage } from "@company/runtime/client/events"

/** A resumable pull consumer. Advance only after apply succeeds; restart from the last acknowledged cursor. */
export function createEventConsumer(options: {
  readonly initialCursor?: string | undefined
  readonly read: (cursor: string, signal: AbortSignal) => Promise<EventPage>
  readonly apply: (page: EventPage) => void | Promise<void>
  readonly isInvalidCursor: (error: unknown) => boolean
}) {
  let cursor = options.initialCursor ?? "now"
  const apply = async (page: EventPage, signal: AbortSignal) => {
    if (signal.aborted) return false
    await options.apply(page)
    if (!signal.aborted) cursor = page.nextCursor
    return page.hasMore
  }
  return {
    get cursor() {
      return cursor
    },
    apply,
    restart: () => {
      cursor = "now"
    },
    poll: async (signal: AbortSignal) => {
      try {
        const page = await options.read(cursor, signal)
        return await apply(page, signal)
      } catch (error) {
        if (options.isInvalidCursor(error)) cursor = "now"
        throw error
      }
    },
  }
}
