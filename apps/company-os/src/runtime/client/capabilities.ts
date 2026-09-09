import {
  type Action,
  type ModelObject,
  type ObjectType,
  modelObjects,
} from "#/runtime/model/index.ts"
import type { ModelCatalog } from "#/runtime/model/index.ts"

/** Maximum number of authorization decisions accepted by one public request. */
export const MAX_CAPABILITY_CHECKS = 200

export const applicationCapabilities = {
  develop: { permission: "application.develop" },
} as const

type ActionPermissionId<TObject extends ObjectType> =
  TObject["actions"][keyof TObject["actions"]] extends infer TAction
    ? TAction extends Action
      ? TAction["id"] extends "batchDelete"
        ? never
        : TAction["id"]
      : never
    : never

type ObjectCapabilityPermission<TObject> = TObject extends ObjectType
  ?
      | `${TObject["id"]}.get`
      | `${TObject["id"]}.list`
      | `${TObject["id"]}.${keyof TObject["queries"] & string}`
      | `${TObject["id"]}.${ActionPermissionId<TObject>}`
  : never

type ModelCapabilityPermission = ObjectCapabilityPermission<
  ModelObject<ModelCatalog>
>

type ApplicationCapabilityPermission =
  (typeof applicationCapabilities)[keyof typeof applicationCapabilities]["permission"]

/** Closed permission vocabulary governed by the application authorization policy. */
export type CapabilityPermission =
  | ApplicationCapabilityPermission
  | ModelCapabilityPermission

export function createCapabilities(Model: ModelCatalog) {
  const objectPermissions = modelObjects(Model).flatMap((object) => [
    `${object.id}.get`,
    `${object.id}.list`,
    ...Object.keys(object.queries).map((id) => `${object.id}.${id}`),
    ...Object.values(object.actions).flatMap((action) =>
      action.id === "batchDelete" ? [] : [`${object.id}.${action.id}`]
    ),
  ])

  function isModelCapabilityPermission(
    value: string
  ): value is ModelCapabilityPermission {
    const [objectId, operation, extra] = value.split(".")
    if (
      objectId === undefined ||
      operation === undefined ||
      extra !== undefined
    ) {
      return false
    }
    const object = modelObjects(Model).find(({ id }) => id === objectId)
    if (object === undefined) return false
    if (operation === "get" || operation === "list") return true
    if (Object.hasOwn(object.queries, operation)) return true
    return Object.values(object.actions).some(
      (action) => action.id !== "batchDelete" && action.id === operation
    )
  }

  const modelCapabilityPermissions = objectPermissions.map((permission) => {
    if (!isModelCapabilityPermission(permission)) {
      throw new Error(`Model generated unknown permission '${permission}'.`)
    }
    return permission
  })

  const capabilityPermissions: ReadonlyArray<CapabilityPermission> = [
    ...modelCapabilityPermissions,
    applicationCapabilities.develop.permission,
  ]

  const capabilityPermissionSet = new Set<string>(capabilityPermissions)

  function isCapabilityPermission(
    value: string
  ): value is CapabilityPermission {
    return capabilityPermissionSet.has(value)
  }

  /** Narrows a model-derived permission and fails if code references no capability. */
  function capabilityPermission(value: string): CapabilityPermission {
    if (isCapabilityPermission(value)) return value
    throw new Error(`Unknown capability permission '${value}'.`)
  }

  /** Returns the permission represented by a model action, when it is governed. */
  function actionPermission(
    objectType: string,
    actionId: string
  ): CapabilityPermission | undefined {
    const normalizedAction = actionId === "batchDelete" ? "delete" : actionId
    const permission = `${objectType}.${normalizedAction}`
    return isCapabilityPermission(permission) ? permission : undefined
  }

  return {
    capabilityPermissions,
    isCapabilityPermission,
    capabilityPermission,
    actionPermission,
  }
}
export interface CapabilityCheck {
  readonly permission: CapabilityPermission
  /** Canonical target ID. Omit to ask whether the actor has this permission anywhere. */
  readonly target?: string
}

export function capabilityKey(check: CapabilityCheck): string {
  return JSON.stringify([check.permission, check.target ?? null])
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
