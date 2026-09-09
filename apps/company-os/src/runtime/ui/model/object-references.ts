import { hashKey, useQueries } from "@tanstack/react-query"

import { isNewerOrEqualRecord } from "#/runtime/client/model-cache.ts"
import { MAX_PAGE_SIZE } from "#/runtime/model/index.ts"
import { ROOT_ID } from "#/runtime/model/system-records.ts"
import {
  clientFor,
  recordLabel,
  recordObjectTypes,
  tableRecord,
  type ObjectRecordPresentation,
  type ClientRecord,
  type ModelObject,
} from "#/runtime/ui/model/object-client.ts"
import { objectTablePropertySchema } from "#/runtime/ui/model/object-table/object-table-cell-types.ts"
import {
  useModelRuntime,
  type ModelUiRuntime,
} from "#/runtime/ui/model/runtime-context.tsx"

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
  return useObjectReferencePages(object, [records])
}

export function useObjectReferencePages(
  object: ModelObject,
  pages: ReadonlyArray<ReadonlyArray<ClientRecord>>
) {
  return useRecordReferenceBatches(
    pages.map((records) => records.map((record) => ({ object, record })))
  )
}

type ReferenceItem = {
  readonly object: ModelObject
  readonly record: ClientRecord
}

/** Resolves a heterogeneous collection together, including audit actors. */
export function useRecordReferences(items: ReadonlyArray<ReferenceItem>) {
  return useRecordReferenceBatches([items])
}

/** Page-local requests retain their query keys when later pages introduce more references. */
function recordReferenceRequests(
  runtime: ModelUiRuntime,
  items: ReadonlyArray<ReferenceItem>
) {
  const references = new Map<string, Set<string>>()
  const add = (type: string, value: unknown) => {
    if (typeof value !== "string" || value === ROOT_ID) return
    const ids = references.get(type) ?? new Set<string>()
    ids.add(value)
    references.set(type, ids)
  }
  for (const { object, record } of items) {
    add(runtime.model.actor.id, record.createdBy)
    if (object.parent.kind !== "root") add(object.parent.typeId, record.parent)
    for (const [key, property] of Object.entries(object.properties)) {
      const field = objectTablePropertySchema(property)
      if (field.kind === "recordId") add(field.typeId, record[key])
    }
  }
  return [...references].flatMap(([type, ids]) =>
    recordObjectTypes(runtime, type).flatMap((target) =>
      chunks([...ids].sort(), MAX_PAGE_SIZE).map((batch) => ({
        target,
        query: clientFor(runtime, target).list({
          filter: { field: "id", operator: "in", value: batch },
          pageSize: MAX_PAGE_SIZE,
        }),
      }))
    )
  )
}

function useRecordReferenceBatches(
  batches: ReadonlyArray<ReadonlyArray<ReferenceItem>>
) {
  const runtime = useModelRuntime()
  const requests = [
    ...new Map(
      batches
        .flatMap((items) => recordReferenceRequests(runtime, items))
        .map((request) => [hashKey(request.query.queryKey), request])
    ).values(),
  ]
  const results = useQueries({ queries: requests.map(({ query }) => query) })
  const labels = new Map<string, string>([[ROOT_ID, runtime.model.root.name]])
  const recordsById = new Map<string, ObjectRecordPresentation>()
  const versions = new Map<string, ClientRecord>()
  results.forEach((result, index) => {
    const target = requests[index]!.target
    for (const record of result.data?.items ?? []) {
      const previous = versions.get(record.id)
      if (previous && !isNewerOrEqualRecord(record, previous)) continue
      versions.set(record.id, record)
      labels.set(record.id, recordLabel(target, record))
      recordsById.set(record.id, {
        object: target,
        record: tableRecord(target, record),
      })
    }
  })
  return { labels, records: recordsById }
}
