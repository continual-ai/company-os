import { Model } from "@company/model"
import { modelObjects } from "@company/runtime"

/** Maximum number of authorization decisions accepted by one public request. */
export const MAX_CAPABILITY_CHECKS = 200

/** Closed permission vocabulary governed by Company OS authorization. */
export const capabilityPermissions: ReadonlyArray<string> = modelObjects(
  Model
).flatMap((object) => [
  `${object.id}.get`,
  `${object.id}.list`,
  ...Object.values(object.actions).flatMap((action) => {
    return action.id === "batchDelete" ? [] : [`${object.id}.${action.id}`]
  }),
])

const capabilityPermissionSet = new Set(capabilityPermissions)

export function isCapabilityPermission(
  value: string
): value is CapabilityPermission {
  return capabilityPermissionSet.has(value)
}

// The exact vocabulary is derived from the model and validated at the HTTP
// boundary; keeping this structural avoids duplicating the model in types.
export type CapabilityPermission = string

export interface CapabilityCheck {
  readonly permission: CapabilityPermission
  /** Canonical target ID. Omit to ask whether the actor has this permission anywhere. */
  readonly target?: string
}

export function capabilityKey(check: CapabilityCheck): string {
  return `${check.permission}\u0000${check.target ?? ""}`
}

/** Returns the permission represented by a model action, when it is governed. */
export function actionPermission(
  objectType: string,
  actionId: string
): CapabilityPermission | undefined {
  const normalizedAction = actionId === "batchDelete" ? "delete" : actionId
  const permission = `${objectType}.${normalizedAction}`
  return isCapabilityPermission(permission) ? permission : undefined
}
