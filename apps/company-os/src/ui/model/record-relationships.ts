import {
  modelObjectLinkTraversals,
  modelRelationships,
  modelTypeAccepts,
} from "@company/runtime"
import { Model } from "company-os/model"

import { modelUi } from "@/app-ui"
import type { CapabilityCheck } from "@/capabilities"

import { objectCapabilityCheck } from "./object-capabilities"
import {
  clientFor,
  linkClientFor,
  recordLabel,
  recordObjectTypes,
  type ClientRecord,
  type ModelObject,
} from "./object-client"
import type { ObjectCreateOptions } from "./object-create-context"
import { objectFormProperties } from "./object-form"
import type { ObjectCollectionList } from "./use-object-collection"

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

const check = (target: ModelObject, action: string, id?: string) => {
  const value = objectCapabilityCheck(target, action, id)
  return value ? [value] : []
}
/** Bind navigation, queries and supported writes once, from the model's named endpoints. */
export function recordRelationships(
  object: ModelObject,
  record: ClientRecord
): ReadonlyArray<RecordRelationship> {
  const labels = new Map([[record.id, recordLabel(object, record)]])
  const traversals = modelObjectLinkTraversals(Model, object)
  return modelRelationships(Model).flatMap(
    (relationship): RecordRelationship[] => {
      const storage = relationship.storage
      if (storage.kind !== "link") {
        if (
          !modelTypeAccepts(Model, object.id, relationship.reverse.from.typeId)
        )
          return []
        const target = Object.values(Model.objects).find(
          (item) => item.id === storage.objectType
        )!
        const client = clientFor(target)
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
              modelUi[target.id]?.navigation?.hidden !== true &&
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
            checks: check(target, "update"),
          },
        ]
      }
      return traversals
        .filter((item) => item.link.id === storage.linkId)
        .map((traversal): RecordRelationship => {
          const client = linkClientFor(object, traversal)
          const targets = recordObjectTypes(traversal.target.from.typeId)
          const target = targets.find(
            (item) => item.id === traversal.target.from.typeId
          )
          const inverseFor = (targetObject: ModelObject) =>
            modelObjectLinkTraversals(Model, targetObject).find(
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
            const inverse = linkClientFor(endpoint, inverseFor(endpoint))
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
              (item) => modelUi[item.id]?.navigation?.hidden !== true
            ),
            list: (request) => client.list({ ...request, id: record.id }),
            creates: targets.flatMap((item) => {
              if (!clientFor(item).create) return []
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
                    ...check(item, "create"),
                    ...(!inverse.writable
                      ? check(object, "update", record.id)
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
              ? check(object, "update", record.id)
              : targets.flatMap((item) => check(item, "update")),
          }
        })
    }
  )
}
