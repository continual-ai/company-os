import { modelObjectLinkTraversals } from "#/runtime/model/index.ts"
import {
  clientFor,
  linkClientFor,
  recordLabel,
  recordObjectTypes,
  type ClientRecord,
  type ModelObject,
} from "#/runtime/ui/model/object-client.ts"
import type { ObjectCreateOptions } from "#/runtime/ui/model/object-create-context.ts"
import { type ModelUiRuntime } from "#/runtime/ui/model/runtime-context.tsx"
import type { ObjectCollectionList } from "#/runtime/ui/model/use-object-collection.ts"

interface RelatedCreate {
  readonly target: ModelObject
  readonly options: ObjectCreateOptions
}

/** A record-bound projection of the model relationship; consumers never interpret storage kinds. */
export interface RecordRelationship {
  readonly key: string
  readonly label: string
  readonly description?: string | undefined
  readonly featured: boolean
  readonly targetType: string
  readonly target?: ModelObject | undefined
  readonly min: number
  readonly max: number | undefined
  readonly list: ObjectCollectionList
  readonly creates: ReadonlyArray<RelatedCreate>
  readonly connect?:
    | ((id: string, objectType: string) => Promise<void>)
    | undefined
  readonly disconnect?: ((record: ClientRecord) => Promise<void>) | undefined
}

/** Bind navigation, queries and supported writes once, from the model's named endpoints. */
export function recordRelationships(
  runtime: ModelUiRuntime,
  object: ModelObject,
  record: ClientRecord
): ReadonlyArray<RecordRelationship> {
  const labels = new Map([[record.id, recordLabel(object, record)]])
  const traversals = modelObjectLinkTraversals(runtime.model, object)
  return traversals.map((traversal): RecordRelationship => {
    const client = linkClientFor(runtime, object, traversal)
    const targets = recordObjectTypes(runtime, traversal.target.from.typeId)
    const target = targets.find(
      (item) => item.id === traversal.target.from.typeId
    )
    const inverseFor = (targetObject: ModelObject) =>
      modelObjectLinkTraversals(runtime.model, targetObject).find(
        (item) =>
          item.link.id === traversal.link.id &&
          item.direction !== traversal.direction
      )!
    return {
      key: traversal.traversal.key,
      label: traversal.traversal.label,
      description: traversal.traversal.description,
      targetType: traversal.target.from.typeId,
      target,
      min: traversal.traversal.min,
      max: traversal.traversal.max,
      featured: targets.some(
        (item) => runtime.ui[item.id]?.navigation?.hidden !== true
      ),
      list: (request) => client.list({ ...request, id: record.id }),
      creates: targets.flatMap((item) => {
        if (!clientFor(runtime, item).create) return []
        const inverse = inverseFor(item)
        return [
          {
            target: item,
            options: {
              initialValues: {
                links: {
                  [inverse.traversal.key]: [record.id],
                },
              },
              referenceLabels: labels,
            },
          },
        ]
      }),
      connect: (id) => client.link!({ id: record.id, target: id }),
      disconnect: (item) => client.unlink!({ id: record.id, target: item.id }),
    }
  })
}
