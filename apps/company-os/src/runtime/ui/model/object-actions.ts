import type { ObjectType } from "#/runtime/model/definition/object.ts"
import type { ModelCatalog } from "#/runtime/model/index.ts"
import type { ClientRecord } from "#/runtime/ui/model/object-client.ts"

/** Advisory controls; the server owns business invariants and immutable system records. */
export function objectActionAvailable(
  model: ModelCatalog,
  object: ObjectType,
  actionId: string,
  record?: ClientRecord
) {
  if (actionId === "get") return record !== undefined
  const action = model.actions[`${object.id}.${actionId}`]
  return (
    action !== undefined &&
    (action.scope === "object" ||
      (record !== undefined && record.systemManaged !== true))
  )
}
