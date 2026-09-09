import { hashKey, useQueries, useQueryClient } from "@tanstack/react-query"

import {
  capabilityKey,
  type CapabilityCheck,
} from "#/runtime/contract/capabilities.ts"
import { useModelRuntime } from "#/runtime/ui/model/runtime-context.tsx"

/** Fail-closed advisory checks share the same observable cache as business queries. */
export function useCapabilities(checks: ReadonlyArray<CapabilityCheck>) {
  return useCapabilityBatches([checks])
}

/** Independent batches keep earlier decisions available as a collection appends pages. */
export function useCapabilityBatches(
  batches: ReadonlyArray<ReadonlyArray<CapabilityCheck>>
) {
  const cache = useQueryClient()
  const runtime = useModelRuntime()
  const queries = [
    ...new Map(
      batches
        .filter((checks) => checks.length > 0)
        .map((checks) => {
          const query = runtime.capabilities(checks)
          return [hashKey(query.queryKey), query] as const
        })
    ).values(),
  ]
  const results = useQueries({ queries })
  const allowed = new Set(results.flatMap((result) => result.data ?? []))
  return {
    can: (check: CapabilityCheck) => allowed.has(capabilityKey(check)),
    error: results.find((result) => result.error)?.error ?? undefined,
    loading: results.some((result) => result.isPending),
    refresh: () => {
      void cache.invalidateQueries({ queryKey: ["model", "@iam"] })
    },
  }
}
