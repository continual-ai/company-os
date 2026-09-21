import { Predicate } from "effect"

import type { ApiError } from "#/runtime/model/index.ts"

/** Translate recognized PostgreSQL link and concurrency failures. */
export function constraintApiError(error: unknown): ApiError | undefined {
  let cause = error
  for (
    let depth = 0;
    depth < 8 && typeof cause === "object" && cause !== null;
    depth++
  ) {
    const code = Predicate.hasProperty(cause, "code") ? cause.code : undefined
    if (code === "23503")
      return {
        status: "FAILED_PRECONDITION",
        reason: "FAILED_PRECONDITION",
        message: "The change would leave an invalid link.",
        details: {
          violations: [
            {
              reason: "RELATIONSHIP_REQUIRED",
              message: "Referenced records must exist.",
            },
          ],
        },
      }
    if (code === "23505")
      return {
        status: "ALREADY_EXISTS",
        reason: "ALREADY_EXISTS",
        message: "A record or link with these values already exists.",
        details: {
          violations: [
            {
              reason: "NOT_UNIQUE",
              message: "The change conflicts with a uniqueness constraint.",
            },
          ],
        },
      }
    if (code === "40001" || code === "40P01")
      return {
        status: "ABORTED",
        reason: "ABORTED",
        message:
          "A concurrent change conflicted with this operation. Reload and retry.",
        details: {},
      }
    cause = Predicate.hasProperty(cause, "cause") ? cause.cause : undefined
  }
  return undefined
}
