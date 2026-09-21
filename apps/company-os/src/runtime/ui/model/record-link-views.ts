import { modelPagedQuery } from "#/runtime/client/model-query-client.ts"
import type { ObjectType } from "#/runtime/model/definition/object.ts"
import { modelObjectLinkTraversals, type Page } from "#/runtime/model/index.ts"
import { linkPreview } from "#/runtime/model/record-links.ts"
import {
  clientFor,
  linkClientFor,
  recordLabel,
  recordObjectTypes,
  type ClientRecord,
} from "#/runtime/ui/model/object-client.ts"
import type { ObjectCreateOptions } from "#/runtime/ui/model/object-create-context.ts"
import { type ModelUiRuntime } from "#/runtime/ui/model/runtime-context.tsx"
import type { ObjectCollectionList } from "#/runtime/ui/model/use-object-collection.ts"

interface RelatedCreate {
  readonly target: ObjectType
  readonly options: ObjectCreateOptions
}

/** A record-bound projection of the model link; consumers never interpret storage kinds. */
export interface RecordLinkView {
  readonly key: string
  readonly label: string
  readonly description?: string | undefined
  readonly featured: boolean
  readonly targetType: string
  readonly target?: ObjectType | undefined
  readonly max: 1 | undefined
  readonly list: ObjectCollectionList
  readonly creates: ReadonlyArray<RelatedCreate>
  readonly link?: ((id: string) => Promise<void>) | undefined
  readonly unlink?: ((record: ClientRecord) => Promise<void>) | undefined
}

/** Bind navigation, queries and supported writes once, from the model's named endpoints. */
export function recordLinkViews(
  runtime: ModelUiRuntime,
  object: ObjectType,
  record: ClientRecord
): ReadonlyArray<RecordLinkView> {
  const labels = new Map([[record.id, recordLabel(object, record)]])
  const traversals = modelObjectLinkTraversals(runtime.model, object)
  return traversals.map((traversal): RecordLinkView => {
    const client = linkClientFor(runtime, object, traversal, record)
    const editable = traversal.writable && record.systemManaged !== true
    const targets = recordObjectTypes(runtime, traversal.inverse.from.typeId)
    const target = targets.find(
      (item) => item.id === traversal.inverse.from.typeId
    )
    const inverseFor = (targetObject: ObjectType) =>
      modelObjectLinkTraversals(runtime.model, targetObject).find(
        (item) =>
          item.link.id === traversal.link.id &&
          item.direction !== traversal.direction
      )!
    return {
      key: traversal.traversal.key,
      label: traversal.traversal.label,
      description: traversal.traversal.description,
      targetType: traversal.inverse.from.typeId,
      target,
      max: traversal.traversal.max === 1 ? 1 : undefined,
      featured: targets.some(
        (item) => runtime.ui[item.id]?.navigation?.hidden !== true
      ),
      list: modelPagedQuery<Page<ClientRecord>>((request) =>
        client.list.queryOptions({ ...request, id: record.id })
      ),
      creates: targets.flatMap((item) => {
        if (!editable || !clientFor(runtime, item).create) return []
        if (
          traversal.traversal.max === 1 &&
          linkPreview(record.links?.[traversal.traversal.key]).ids.length > 0
        )
          return []
        const inverse = inverseFor(item)
        if (!inverse.writable) return []
        return [
          {
            target: item,
            options: {
              initialValues: {
                links: {
                  [inverse.traversal.key]:
                    inverse.traversal.max === 1 ? record.id : [record.id],
                },
              },
              referenceLabels: labels,
            },
          },
        ]
      }),
      ...(editable && client.link
        ? {
            link: (id: string) => client.link!({ id: record.id, target: id }),
          }
        : {}),
      ...(editable && client.unlink
        ? {
            unlink: (item: ClientRecord) =>
              client.unlink!({ id: record.id, target: item.id }),
          }
        : {}),
    }
  })
}
