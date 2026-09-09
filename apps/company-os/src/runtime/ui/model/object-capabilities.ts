import {
  capabilityKey,
  type CapabilityCheck,
} from "#/runtime/contract/capabilities.ts"
import { ROOT_ID } from "#/runtime/model/system-records.ts"
import type { ModelObject } from "#/runtime/ui/model/object-client.ts"
import { type ModelUiRuntime } from "#/runtime/ui/model/runtime-context.tsx"

export function objectCapabilityCheck(
  runtime: ModelUiRuntime,
  object: ModelObject,
  actionId: string,
  target?: string
): CapabilityCheck | undefined {
  const permission = runtime.permissions.actionPermission(object.id, actionId)
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
  runtime: ModelUiRuntime,
  object: ModelObject,
  recordIds: ReadonlyArray<string>
): ReadonlyArray<CapabilityCheck> {
  const checks = new Map<string, CapabilityCheck>()
  for (const recordId of recordIds) {
    const check = objectCapabilityCheck(runtime, object, "get", recordId)
    if (check !== undefined) checks.set(capabilityKey(check), check)
  }
  for (const action of Object.values(object.actions)) {
    if (action.id === "batchDelete") continue
    if (action.scope === "collection") {
      const check = objectCapabilityCheck(runtime, object, action.id)
      if (check !== undefined) checks.set(capabilityKey(check), check)
      continue
    }
    for (const recordId of recordIds) {
      const check = objectCapabilityCheck(runtime, object, action.id, recordId)
      if (check !== undefined) checks.set(capabilityKey(check), check)
    }
  }
  return [...checks.values()]
}

/** Collection and page batches are shared by route preloading and mounted table controls. */
export function collectionCapabilityBatches(
  runtime: ModelUiRuntime,
  object: ModelObject,
  pages: ReadonlyArray<ReadonlyArray<{ readonly id: string }>>
) {
  const forTarget = (target?: string) =>
    Object.keys(object.actions).flatMap((action) => {
      const check = objectCapabilityCheck(runtime, object, action, target)
      return check === undefined ? [] : [check]
    })
  return [
    forTarget(),
    ...pages.map((records) =>
      records.flatMap((record) => forTarget(record.id))
    ),
  ]
}
