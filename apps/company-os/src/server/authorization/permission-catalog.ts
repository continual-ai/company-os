import { Model } from "@company/model"
import type {
  ObjectAccessRequest,
  ObjectOperation,
} from "@company/runtime/effect/object-service"

function permissionOperation(operation: ObjectOperation): string {
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
export const modelPermissions: ReadonlyArray<string> = [
  ...Object.keys(Model.objects).flatMap((objectType) => [
    `${objectType}.get`,
    `${objectType}.list`,
  ]),
  ...Object.values(Model.actions).flatMap((actions) =>
    Object.values(actions)
      .filter(({ id }) => id !== "batchDelete")
      .map((action) => `${action.objectType}.${action.id}`)
  ),
]

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
