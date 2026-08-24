import { AcmeModel } from "@acme/api"
import type {
  ObjectAccessRequest,
  ObjectOperation,
} from "@continual/runtime/effect/object-service"

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

/** Maps a runtime object operation to Acme's exact permission vocabulary. */
export function objectPermission(request: ObjectAccessRequest): string {
  return `${request.objectType}.${permissionOperation(request.operation)}`
}

/** Every permission currently declared by Acme's closed-world model. */
export const modelPermissions: ReadonlyArray<string> = [
  ...Object.keys(AcmeModel.objects).flatMap((objectType) => [
    `${objectType}.get`,
    `${objectType}.list`,
  ]),
  ...Object.values(AcmeModel.actions).flatMap((actions) =>
    Object.values(actions)
      .filter(({ id }) => id !== "batchDelete")
      .map((action) => `${action.objectType}.${action.id}`)
  ),
]
