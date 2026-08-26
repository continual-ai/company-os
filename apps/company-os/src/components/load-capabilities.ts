import { Effect } from "effect"

import {
  allowedCapabilityKeys,
  capabilityKey,
  MAX_CAPABILITY_CHECKS,
  type CapabilityCheck,
} from "@/capabilities"
import { httpClient } from "@/http-client"

function chunks<T>(values: ReadonlyArray<T>, size: number): ReadonlyArray<T[]> {
  const result: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size))
  }
  return result
}

/** Resolves advisory UI capabilities in bounded batches and fails closed. */
export async function loadAllowedCapabilities(
  requestedChecks: ReadonlyArray<CapabilityCheck>
): Promise<ReadonlySet<string>> {
  const checks = [
    ...new Map(
      requestedChecks.map((check) => [capabilityKey(check), check])
    ).values(),
  ]
  if (checks.length === 0) return new Set()
  const responses = await Promise.all(
    chunks(checks, MAX_CAPABILITY_CHECKS).map((batch) =>
      Effect.runPromise(
        httpClient.capabilities.checkCapabilities({
          payload: { checks: batch },
        })
      )
    )
  )
  return allowedCapabilityKeys(
    checks,
    responses.flatMap(({ results }) => results)
  )
}
