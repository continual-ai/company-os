import type {
  ClientRecord,
  ModelObject,
} from "#/runtime/ui/model/object-client.ts"

/** Advisory controls; the server owns business invariants and immutable system records. */
export function objectActionAvailable(
  object: ModelObject,
  actionId: string,
  record?: ClientRecord
) {
  if (actionId === "get") return record !== undefined
  const action = object.actions[actionId]
  return (
    action !== undefined &&
    (action.scope === "collection" ||
      (record !== undefined && record.systemManaged !== true))
  )
}
