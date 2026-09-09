import type { CapabilityCheck } from "#/runtime/client/capabilities.ts"
import {
  modelObjectLinkTraversals,
  modelRelationships,
  modelTypeAccepts,
} from "#/runtime/model/index.ts"
import { objectCapabilityCheck } from "#/runtime/ui/model/object-capabilities.ts"
import {
  clientFor,
  linkClientFor,
  recordLabel,
  recordObjectTypes,
  type ClientRecord,
  type ModelObject,
} from "#/runtime/ui/model/object-client.ts"
import type { ObjectCreateOptions } from "#/runtime/ui/model/object-create-context.ts"
import { objectFormProperties } from "#/runtime/ui/model/object-form.ts"
import { type ModelUiRuntime } from "#/runtime/ui/model/runtime-context.tsx"
import type { ObjectCollectionList } from "#/runtime/ui/model/use-object-collection.ts"

interface RelatedCreate {
  readonly target: ModelObject
  readonly options: ObjectCreateOptions
  readonly checks: ReadonlyArray<CapabilityCheck>
}

/** A record-bound projection of the model relationship; consumers never interpret storage kinds. */
export interface RecordRelationship {
  readonly key: string
  readonly label: string
  readonly description?: string | undefined
  readonly featured: boolean
  readonly targetType: string
  readonly target?: ModelObject | undefined
  readonly cardinality: "one" | "zeroOrOne" | "many"
  readonly list: ObjectCollectionList
  readonly creates: ReadonlyArray<RelatedCreate>
  readonly connect?:
    | ((id: string, objectType: string) => Promise<void>)
    | undefined
  readonly disconnect?: ((record: ClientRecord) => Promise<void>) | undefined
  readonly checks: ReadonlyArray<CapabilityCheck>
}

const check = (
  runtime: ModelUiRuntime,
  target: ModelObject,
  action: string,
  id?: string
) => {
  const value = objectCapabilityCheck(runtime, target, action, id)
  return value ? [value] : []
}
/** Bind navigation, queries and supported writes once, from the model's named endpoints. */
export function recordRelationships(
  runtime: ModelUiRuntime,
  object: ModelObject,
  record: ClientRecord
): ReadonlyArray<RecordRelationship> {
  const labels = new Map([[record.id, recordLabel(object, record)]])
  const traversals = modelObjectLinkTraversals(runtime.model, object)
  return modelRelationships(runtime.model).flatMap(
    (relationship): RecordRelationship[] => {
      const storage = relationship.storage
      if (storage.kind !== "link") {
        if (
          !modelTypeAccepts(
            runtime.model,
            object.id,
            relationship.reverse.from.typeId
          )
        )
          return []
        const target = Object.values(runtime.model.objects).find(
          (item) => item.id === storage.objectType
        )!
        const client = clientFor(runtime, target)
        const field = storage.property
        const writable =
          field !== "parent" &&
          objectFormProperties(target, "edit").some(({ id }) => id === field)
        const createable =
          field === "parent" ||
          objectFormProperties(target, "create").some(({ id }) => id === field)
        const setReference =
          client.update && writable
            ? async (id: string, value: string | null) => {
                const current = await client
                  .get({ id })
                  .queryFn({ signal: new AbortController().signal })
                await client.update!({ id, etag: current.etag, [field]: value })
              }
            : undefined
        return [
          {
            key: relationship.reverse.key,
            label: relationship.reverse.label,
            targetType: target.id,
            target,
            cardinality: "many",
            featured:
              runtime.ui[target.id]?.navigation?.hidden !== true &&
              (field !== "parent" || target.parent.kind !== "interface"),
            list: (request) =>
              client.list({
                ...request,
                filter: {
                  and: [
                    { field, operator: "eq", value: record.id },
                    ...(request.filter ? [request.filter] : []),
                  ],
                },
              }),
            creates:
              client.create && createable
                ? [
                    {
                      target,
                      options: {
                        initialValues: { [field]: record.id },
                        referenceLabels: labels,
                      },
                      checks: check(
                        runtime,
                        target,
                        "create",
                        field === "parent" ? record.id : undefined
                      ),
                    },
                  ]
                : [],
            connect: setReference
              ? (id) => setReference(id, record.id)
              : undefined,
            disconnect:
              setReference && relationship.forward.cardinality === "zeroOrOne"
                ? (item) => setReference(item.id, null)
                : undefined,
            checks: check(runtime, target, "update"),
          },
        ]
      }
      return traversals
        .filter((item) => item.link.id === storage.linkId)
        .map((traversal): RecordRelationship => {
          const client = linkClientFor(runtime, object, traversal)
          const targets = recordObjectTypes(
            runtime,
            traversal.target.from.typeId
          )
          const target = targets.find(
            (item) => item.id === traversal.target.from.typeId
          )
          const inverseFor = (targetObject: ModelObject) =>
            modelObjectLinkTraversals(runtime.model, targetObject).find(
              (item) =>
                item.link.id === traversal.link.id &&
                item.direction !== traversal.direction
            )!
          const mutate = async (
            id: string,
            objectType: string,
            operation: "link" | "unlink"
          ) => {
            if (client[operation]) {
              await client[operation]({ id: record.id, target: id })
              return
            }
            // The picker or list supplies the concrete type; record IDs remain opaque.
            const endpoint = targets.find((item) => item.id === objectType)
            if (!endpoint)
              throw new Error("The related record type is unavailable.")
            const inverse = linkClientFor(
              runtime,
              endpoint,
              inverseFor(endpoint)
            )
            const action = inverse[operation]
            if (!action) throw new Error("This relationship cannot be changed.")
            await action({ id, target: record.id })
          }
          return {
            key: traversal.traversal.key,
            label: traversal.traversal.label,
            description: traversal.traversal.description,
            targetType: traversal.target.from.typeId,
            target,
            cardinality: traversal.traversal.cardinality,
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
                        [inverse.traversal.key]:
                          inverse.traversal.cardinality === "many"
                            ? [record.id]
                            : record.id,
                      },
                    },
                    referenceLabels: labels,
                  },
                  checks: [
                    ...check(runtime, item, "create"),
                    ...(!inverse.writable
                      ? check(runtime, object, "update", record.id)
                      : []),
                  ],
                },
              ]
            }),
            connect:
              traversal.link.writeFrom === false
                ? undefined
                : (id, objectType) => mutate(id, objectType, "link"),
            disconnect:
              traversal.link.writeFrom !== false &&
              traversal.traversal.cardinality !== "one" &&
              traversal.target.cardinality !== "one"
                ? (item) =>
                    mutate(
                      item.id,
                      typeof item.objectType === "string"
                        ? item.objectType
                        : (target?.id ?? ""),
                      "unlink"
                    )
                : undefined,
            checks: traversal.writable
              ? check(runtime, object, "update", record.id)
              : targets.flatMap((item) => check(runtime, item, "update")),
          }
        })
    }
  )
}
