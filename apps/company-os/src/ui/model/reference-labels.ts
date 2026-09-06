import { MAX_PAGE_SIZE } from "@company/runtime"
import { useQueries } from "@tanstack/react-query"
import { Model } from "company-os/model"

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

/** Resolve only visible references in bounded batches; unavailable records stay unlabeled. */
export function useReferenceLabels(
  object: ModelObject,
  records: ReadonlyArray<ClientRecord>
): ReadonlyMap<string, string> {
  const references = new Map<string, Set<string>>()
  const add = (type: string, value: unknown) => {
    if (typeof value !== "string" || value === ROOT_ID) return
    const ids = references.get(type) ?? new Set<string>()
    ids.add(value)
    references.set(type, ids)
  }
  for (const record of records) {
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
  results.forEach((result, index) => {
    for (const record of result.data?.items ?? [])
      labels.set(record.id, recordLabel(requests[index]!.target, record))
  })
  return labels
}
