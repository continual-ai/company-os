import { Effect } from "effect"

import { checkCapabilities } from "@/app-client"
import {
  allowedCapabilityKeys,
  capabilityKey,
  MAX_CAPABILITY_CHECKS,
  type CapabilityCheck,
} from "@/capabilities"
import { modelData } from "@/data-client"

function chunks<T>(values: ReadonlyArray<T>, size: number): ReadonlyArray<T[]> {
  const result: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size))
  }
  return result
}

/** Resolves advisory UI capabilities in bounded batches and fails closed. */
export function loadAllowedCapabilities(
  requestedChecks: ReadonlyArray<CapabilityCheck>
): Effect.Effect<ReadonlySet<string>, unknown> {
  return Effect.gen(function* () {
    const checks = [
      ...new Map(
        requestedChecks.map((check) => [capabilityKey(check), check])
      ).values(),
    ]
    if (checks.length === 0) return new Set()
    const responses = yield* Effect.all(
      chunks(checks, MAX_CAPABILITY_CHECKS).map((batch) =>
        modelData().query(
          "@iam",
          "check",
          batch,
          checkCapabilities({
            payload: { checks: batch },
          })
        )
      ),
      { concurrency: "unbounded" }
    )
    return allowedCapabilityKeys(
      checks,
      responses.flatMap(({ results }) => results)
    )
  })
}
