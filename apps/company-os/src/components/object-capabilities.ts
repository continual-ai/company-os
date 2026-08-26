import {
  actionPermission,
  capabilityKey,
  type CapabilityCheck,
} from "@/capabilities"
import { PLATFORM_ID } from "@/system-records"

import type { ModelObject } from "./object-client"

export function objectCapabilityCheck(
  object: ModelObject,
  actionId: string,
  target?: string
): CapabilityCheck | undefined {
  const permission = actionPermission(object.id, actionId)
  if (permission === undefined) return undefined

  const resolvedTarget =
    target ??
    (actionId === "create" && object.parent.kind === "root"
      ? PLATFORM_ID
      : undefined)
  return resolvedTarget === undefined
    ? { permission }
    : { permission, target: resolvedTarget }
}

export function objectCapabilityChecks(
  object: ModelObject,
  recordIds: ReadonlyArray<string>
): ReadonlyArray<CapabilityCheck> {
  const checks = new Map<string, CapabilityCheck>()
  for (const action of Object.values(object.actions)) {
    if (action.id === "batchDelete") continue
    if (action.scope === "collection") {
      const check = objectCapabilityCheck(object, action.id)
      if (check !== undefined) checks.set(capabilityKey(check), check)
      continue
    }
    for (const recordId of recordIds) {
      const check = objectCapabilityCheck(object, action.id, recordId)
      if (check !== undefined) checks.set(capabilityKey(check), check)
    }
  }
  return [...checks.values()]
}

export function allowedCapabilityKeys(
  checks: ReadonlyArray<CapabilityCheck>,
  results: ReadonlyArray<{ readonly allowed: boolean }>
): ReadonlySet<string> {
  if (checks.length !== results.length) {
    throw new Error("Capability response does not match the request.")
  }
  return new Set(
    checks.flatMap((check, index) =>
      results[index]?.allowed === true ? [capabilityKey(check)] : []
    )
  )
}
