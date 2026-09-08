import {
  actionPermission,
  capabilityKey,
  type CapabilityCheck,
} from "#/capabilities.ts"
import { ROOT_ID } from "#/system-records.ts"
import type { ModelObject } from "#/ui/model/object-client.ts"

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
      ? ROOT_ID
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
  for (const recordId of recordIds) {
    const check = objectCapabilityCheck(object, "get", recordId)
    if (check !== undefined) checks.set(capabilityKey(check), check)
  }
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
