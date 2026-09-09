import {
  createCapabilities,
  type CapabilityPermission,
} from "#/runtime/client/capabilities.ts"
import { modelObjects } from "#/runtime/model/index.ts"
import type { ModelCatalog } from "#/runtime/model/index.ts"

/** One model operation on one object, optionally narrowed to records or a creation parent. */
export interface OperationAccessRequest {
  readonly objectType: string
  readonly operationId: string
  readonly parentId?: string
  readonly recordIds?: ReadonlyArray<string>
}

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

export function createPermissionCatalog(Model: ModelCatalog) {
  const {
    capabilityPermission,
    capabilityPermissions,
    isCapabilityPermission,
  } = createCapabilities(Model)
  /** Maps a model operation to the exact permission vocabulary; batch variants share their singular permission. */
  function objectPermission(
    request: Pick<OperationAccessRequest, "objectType" | "operationId">
  ): CapabilityPermission {
    return capabilityPermission(
      `${request.objectType}.${permissionOperation(request.operationId)}`
    )
  }

  /** Every permission currently recognized by the closed application policy. */
  const definedPermissions = capabilityPermissions

  interface PermissionDefinition {
    readonly expectedType?: string
    readonly modifiesTarget: boolean
    readonly objectType: string
    readonly permission: CapabilityPermission
    readonly readPermission?: CapabilityPermission | undefined
  }

  const permissionDefinitions = new Map<string, PermissionDefinition>()

  permissionDefinitions.set("application.develop", {
    modifiesTarget: false,
    objectType: "application",
    permission: "application.develop",
  })

  for (const object of modelObjects(Model)) {
    const readPermission = capabilityPermission(`${object.id}.get`)
    permissionDefinitions.set(readPermission, {
      expectedType: object.id,
      modifiesTarget: false,
      objectType: object.id,
      permission: readPermission,
      readPermission,
    })
    const listPermission = capabilityPermission(`${object.id}.list`)
    permissionDefinitions.set(listPermission, {
      modifiesTarget: false,
      objectType: object.id,
      permission: listPermission,
    })

    for (const query of Object.values(object.queries)) {
      const permission = capabilityPermission(`${object.id}.${query.id}`)
      permissionDefinitions.set(permission, {
        ...(query.scope === "object" ? { expectedType: object.id } : {}),
        modifiesTarget: false,
        objectType: object.id,
        permission,
        readPermission: query.scope === "object" ? readPermission : undefined,
      })
    }
    for (const action of Object.values(object.actions)) {
      const permission = `${object.id}.${permissionOperation(action.id)}`
      if (!isCapabilityPermission(permission)) continue
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
  function permissionDefinition(
    permission: CapabilityPermission
  ): PermissionDefinition {
    const definition = permissionDefinitions.get(permission)
    if (definition === undefined) {
      throw new Error(`Permission '${permission}' has no policy definition.`)
    }
    return definition
  }

  return { objectPermission, permissionDefinition, definedPermissions }
}
