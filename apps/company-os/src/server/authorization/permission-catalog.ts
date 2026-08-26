import { Model } from "@company/model"
import { modelObjects } from "@company/runtime"
import type { ObjectAccessRequest } from "@company/runtime/effect/object-service"

import {
  capabilityPermissions,
  type CapabilityPermission,
} from "@/capabilities"

function permissionOperation(operation: string): string {
  switch (operation) {
    case "batchDelete":
      return "delete"
    case "batchGet":
      return "get"
    default:
      return operation
  }
}

/** Maps a runtime object operation to the model's exact permission vocabulary. */
export function objectPermission(request: ObjectAccessRequest): string {
  return `${request.objectType}.${permissionOperation(request.operation)}`
}

/** Every permission currently declared by the closed-world model. */
export const modelPermissions = capabilityPermissions

export interface PermissionDefinition {
  readonly expectedType?: string
  readonly modifiesTarget: boolean
  readonly objectType: string
  readonly permission: CapabilityPermission
  readonly readPermission?: CapabilityPermission | undefined
}

const permissionDefinitions = new Map<string, PermissionDefinition>()

for (const object of modelObjects(Model)) {
  const readPermission = `${object.id}.get`
  permissionDefinitions.set(readPermission, {
    expectedType: object.id,
    modifiesTarget: false,
    objectType: object.id,
    permission: readPermission,
    readPermission,
  })
  permissionDefinitions.set(`${object.id}.list`, {
    modifiesTarget: false,
    objectType: object.id,
    permission: `${object.id}.list`,
  })

  for (const action of Object.values(object.actions)) {
    const permission = `${object.id}.${permissionOperation(action.id)}`
    if (!capabilityPermissions.includes(permission)) continue
    if (permissionDefinitions.has(permission)) continue

    const objectScoped = action.scope === "object"
    permissionDefinitions.set(permission, {
      expectedType: objectScoped ? object.id : object.parent.typeId,
      modifiesTarget: objectScoped,
      objectType: object.id,
      permission,
      readPermission: objectScoped ? readPermission : undefined,
    })
  }
}

/** Authorization semantics for one validated public permission. */
export function permissionDefinition(
  permission: CapabilityPermission
): PermissionDefinition {
  const definition = permissionDefinitions.get(permission)
  if (definition === undefined) {
    throw new Error(`Permission '${permission}' has no policy definition.`)
  }
  return definition
}

const operatorObjectTypes = new Set([
  "company",
  "contact",
  "deal",
  "interaction",
  "lead",
  "lineItem",
])

/** Business-data permissions granted to the built-in non-administrator role. */
export const operatorPermissions = modelPermissions.filter((permission) =>
  operatorObjectTypes.has(permission.slice(0, permission.indexOf(".")))
)
