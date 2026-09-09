import { Context } from "effect"

/** Request-local cache invalidation, derived only from successfully committed journal events. */
export const CommittedChanges = Context.Reference<Set<string> | undefined>(
  "@company/CommittedChanges",
  { defaultValue: () => undefined }
)
