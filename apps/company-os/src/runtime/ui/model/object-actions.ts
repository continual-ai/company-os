import type { ModelCatalog } from "#/runtime/model/index.ts"
import type {
  ClientRecord,
  ModelObject,
} from "#/runtime/ui/model/object-client.ts"

/** Advisory controls; the server owns business invariants and immutable system records. */
export function objectActionAvailable(
  model: ModelCatalog,
  object: ModelObject,
  actionId: string,
  record?: ClientRecord
) {
  if (actionId === "get") return record !== undefined
  const action = model.actions[`${object.id}.${actionId}`]
  return (
    action !== undefined &&
    (action.scope === "collection" ||
      (record !== undefined && record.systemManaged !== true))
  )
}
