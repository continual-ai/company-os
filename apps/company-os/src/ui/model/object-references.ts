import { MAX_PAGE_SIZE } from "@company/runtime"
import { useQueries } from "@tanstack/react-query"

import { Model } from "#/app.model.ts"
import { ROOT_ID } from "#/system-records.ts"
import {
  clientFor,
  recordLabel,
  recordObjectTypes,
  tableRecord,
  type ObjectRecordPresentation,
  type ClientRecord,
  type ModelObject,
} from "#/ui/model/object-client.ts"
import { objectTablePropertySchema } from "#/ui/model/object-table/object-table-cell-types.ts"

function chunks<T>(values: ReadonlyArray<T>, size: number): ReadonlyArray<T[]> {
  const result: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size))
  }
  return result
}

/** Batch authorized references once for labels and rich identity displays; unavailable records stay unresolved. */
export function useObjectReferences(
  object: ModelObject,
  records: ReadonlyArray<ClientRecord>
) {
  return useRecordReferences(records.map((record) => ({ object, record })))
}

/** Resolves a heterogeneous collection together, including audit actors. */
export function useRecordReferences(
  items: ReadonlyArray<{
    readonly object: ModelObject
    readonly record: ClientRecord
  }>
) {
  const references = new Map<string, Set<string>>()
  const add = (type: string, value: unknown) => {
    if (typeof value !== "string" || value === ROOT_ID) return
    const ids = references.get(type) ?? new Set<string>()
    ids.add(value)
    references.set(type, ids)
  }
  for (const { object, record } of items) {
    add(Model.actor.id, record.createdBy)
    if (object.parent.kind !== "root") add(object.parent.typeId, record.parent)
    for (const [key, property] of Object.entries(object.properties)) {
      const field = objectTablePropertySchema(property)
      if (field.kind === "recordId") add(field.typeId, record[key])
    }
  }
  const requests = [...references].flatMap(([type, ids]) =>
    recordObjectTypes(type).flatMap((target) =>
      chunks([...ids].sort(), MAX_PAGE_SIZE).map((batch) => ({
        target,
        query: clientFor(target).list({
          filter: { field: "id", operator: "in", value: batch },
          pageSize: MAX_PAGE_SIZE,
        }),
      }))
    )
  )
  const results = useQueries({ queries: requests.map(({ query }) => query) })
  const labels = new Map<string, string>([[ROOT_ID, Model.root.name]])
  const recordsById = new Map<string, ObjectRecordPresentation>()
  results.forEach((result, index) => {
    const target = requests[index]!.target
    for (const record of result.data?.items ?? []) {
      labels.set(record.id, recordLabel(target, record))
      recordsById.set(record.id, {
        object: target,
        record: tableRecord(target, record),
      })
    }
  })
  return { labels, records: recordsById }
}
