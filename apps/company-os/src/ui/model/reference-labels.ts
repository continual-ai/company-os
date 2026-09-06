import { MAX_PAGE_SIZE } from "@company/runtime"
import { Model } from "company-os/model"
import { Effect } from "effect"

import { ROOT_ID } from "@/system-records"

import {
  clientFor,
  recordLabel,
  recordObjectTypes,
  type ClientRecord,
  type ModelObject,
} from "./object-client"
import { objectTablePropertySchema } from "./object-table/object-table-cell-types"

function chunks<T>(values: ReadonlyArray<T>, size: number): ReadonlyArray<T[]> {
  const result: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size))
  }
  return result
}

export function loadReferenceLabels(
  object: ModelObject,
  records: ReadonlyArray<ClientRecord>
): Effect.Effect<ReadonlyMap<string, string>, unknown> {
  return Effect.gen(function* () {
    const references = new Map<string, Set<string>>()
    const addReferences = (typeId: string, ids: ReadonlyArray<string>) => {
      const values = references.get(typeId) ?? new Set<string>()
      for (const id of ids) values.add(id)
      references.set(typeId, values)
    }

    if (object.parent.kind !== "root") {
      addReferences(
        object.parent.typeId,
        records.flatMap((record) =>
          record.parent === undefined ? [] : [record.parent]
        )
      )
    }
    for (const [propertyId, property] of Object.entries(object.properties)) {
      const propertySchema = objectTablePropertySchema(property)
      if (propertySchema.kind !== "recordId") continue
      addReferences(
        propertySchema.typeId,
        records.flatMap((record) => {
          const value = record[propertyId]
          // The client record is the parsed API representation; references are
          // the string member of its closed value union.
          return typeof value === "string" ? [value] : []
        })
      )
    }

    const labels = new Map<string, string>([[ROOT_ID, Model.root.name]])
    yield* Effect.all(
      [...references].flatMap(([typeId, values]) =>
        recordObjectTypes(typeId).flatMap((referencedObject) =>
          chunks(
            [...values].filter((id) => id !== ROOT_ID),
            MAX_PAGE_SIZE
          ).map((ids) =>
            Effect.gen(function* () {
              if (ids.length === 0) return
              const referencedClient = clientFor(referencedObject)
              const page = yield* referencedClient.batchGet({ ids }).pipe(
                Effect.catch(() =>
                  referencedClient.list({
                    filter: { field: "id", operator: "in", value: ids },
                    pageSize: MAX_PAGE_SIZE,
                  })
                )
              )
              for (const record of page.items) {
                labels.set(record.id, recordLabel(referencedObject, record))
              }
            })
          )
        )
      ),
      { concurrency: "unbounded" }
    )
    return labels
  })
}
