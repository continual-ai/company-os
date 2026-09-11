import { Predicate } from "effect"

import type { ApiError } from "#/runtime/model/index.ts"

/** PostgreSQL enforces final graph constraints at commit; translate only recognized SQL states. */
export function constraintApiError(error: unknown): ApiError | undefined {
  let cause = error
  for (
    let depth = 0;
    depth < 8 && typeof cause === "object" && cause !== null;
    depth++
  ) {
    const code = Predicate.hasProperty(cause, "code") ? cause.code : undefined
    const constraint =
      Predicate.hasProperty(cause, "constraint") &&
      typeof cause.constraint === "string"
        ? cause.constraint
        : ""
    if (code === "23514" && constraint.endsWith(".bounds")) {
      const [, key] = constraint.split(".")
      return {
        status: "FAILED_PRECONDITION",
        reason: "FAILED_PRECONDITION",
        message: "The change would violate relationship cardinality.",
        details: {
          violations: [
            {
              reason: "LINK_CARDINALITY",
              path: ["links", key ?? "unknown"],
              message:
                "The final number of linked records is outside the allowed bounds.",
            },
          ],
        },
      }
    }
    if (code === "23503")
      return {
        status: "FAILED_PRECONDITION",
        reason: "FAILED_PRECONDITION",
        message: "The change would leave an invalid relationship.",
        details: {
          violations: [
            {
              reason: "RELATIONSHIP_REQUIRED",
              message:
                "Required relationships and subset membership must remain valid.",
            },
          ],
        },
      }
    if (code === "23505")
      return {
        status: "ALREADY_EXISTS",
        reason: "ALREADY_EXISTS",
        message: "A record or relationship with these values already exists.",
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
