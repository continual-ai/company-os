import { useQuery, useQueryClient } from "@tanstack/react-query"

import { capabilityKey, type CapabilityCheck } from "#/capabilities.ts"
import { allowedCapabilitiesQuery } from "#/ui/application/load-capabilities.ts"

/** Fail-closed advisory checks share the same observable cache as business queries. */
export function useCapabilities(checks: ReadonlyArray<CapabilityCheck>) {
  const cache = useQueryClient()
  const query = allowedCapabilitiesQuery(checks)
  const result = useQuery(query)
  return {
    can: (check: CapabilityCheck) =>
      result.data?.includes(capabilityKey(check)) ?? false,
    error: result.error ?? undefined,
    loading: result.isPending,
    refresh: () => {
      void cache.invalidateQueries({ queryKey: ["model", "@iam"] })
    },
  }
}
