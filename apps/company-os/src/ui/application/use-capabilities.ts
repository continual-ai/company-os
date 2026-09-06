import { useMemo } from "react"

import { capabilityKey, type CapabilityCheck } from "@/capabilities"
import { modelData } from "@/data-client"
import { useModelQuery } from "@/use-model-query"

import { loadAllowedCapabilities } from "./load-capabilities"

/** Fail-closed advisory checks share the same observable cache as business queries. */
export function useCapabilities(checks: ReadonlyArray<CapabilityCheck>) {
  const query = useMemo(() => loadAllowedCapabilities(checks), [checks])
  const result = useModelQuery(query)
  return {
    can: (check: CapabilityCheck) =>
      result.value?.has(capabilityKey(check)) ?? false,
    error: result.error,
    loading: result.loading,
    refresh: () => modelData().invalidate(["@iam"]),
  }
}
