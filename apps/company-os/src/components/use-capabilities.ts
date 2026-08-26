import { useEffect, useState } from "react"

import { capabilityKey, type CapabilityCheck } from "@/capabilities"

import { loadAllowedCapabilities } from "./load-capabilities"

/** Fail-closed advisory capability state for rendering client controls. */
export function useCapabilities(checks: ReadonlyArray<CapabilityCheck>) {
  const [allowed, setAllowed] = useState<ReadonlySet<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let current = true
    setAllowed(new Set())
    setLoading(true)
    void loadAllowedCapabilities(checks)
      .then((next) => {
        if (current) {
          setAllowed(next)
          setLoading(false)
        }
      })
      .catch(() => {
        if (current) {
          setAllowed(new Set())
          setLoading(false)
        }
      })
    return () => {
      current = false
    }
  }, [checks])

  return {
    can: (check: CapabilityCheck): boolean => allowed.has(capabilityKey(check)),
    loading,
  } as const
}
