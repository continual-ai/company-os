import { client } from "#/app/app-client.ts"
import { runClientEffect } from "#/runtime/client/create-client.ts"
import { modelQuery } from "#/runtime/client/model-query-client.ts"
import {
  allowedCapabilityKeys,
  capabilityKey,
  MAX_CAPABILITY_CHECKS,
  type CapabilityCheck,
} from "#/runtime/contract/capabilities.ts"

function chunks<T>(values: ReadonlyArray<T>, size: number): ReadonlyArray<T[]> {
  const result: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size))
  }
  return result
}

/** Resolves advisory UI capabilities in bounded batches and fails closed. */
export function allowedCapabilitiesQuery(
  requestedChecks: ReadonlyArray<CapabilityCheck>
) {
  const checks = [
    ...new Map(
      requestedChecks.map((check) => [capabilityKey(check), check])
    ).values(),
  ].sort((a, b) => capabilityKey(a).localeCompare(capabilityKey(b)))
  return modelQuery<ReadonlyArray<string>, unknown>(
    ["@iam"],
    "check",
    checks,
    async (signal) => {
      const responses = await Promise.all(
        chunks(checks, MAX_CAPABILITY_CHECKS).map((batch) =>
          runClientEffect(client.capabilities.check({ checks: batch }), signal)
        )
      )
      return [
        ...allowedCapabilityKeys(
          checks,
          responses.flatMap(({ results }) => results)
        ),
      ]
    }
  )
}
