import { hashKey, useQueries } from "@tanstack/react-query"

import { isNewerOrEqualRecord } from "#/runtime/client/model-cache.ts"
import { MAX_PAGE_SIZE } from "#/runtime/model/index.ts"
import { ROOT_ID } from "#/runtime/model/system-records.ts"
import {
  recordBatchFor,
  recordLabel,
  tableRecord,
  type ClientRecord,
  type ModelObject,
  type ObjectRecordPresentation,
} from "#/runtime/ui/model/object-client.ts"
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

/** Batch references once for labels and rich identity displays; unavailable records stay unresolved. */
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
export function recordReferenceRequests(
  runtime: ModelUiRuntime,
  items: ReadonlyArray<ReferenceItem>
) {
  const ids = new Set<string>()
  for (const { record } of items) {
    if (typeof record.createdBy === "string") ids.add(record.createdBy)
    if (typeof record.updatedBy === "string") ids.add(record.updatedBy)
    for (const link of Object.values(record.links ?? {}))
      for (const id of link.ids) ids.add(id)
  }
  return chunks([...ids].sort(), MAX_PAGE_SIZE).map((batch) => ({
    query: recordBatchFor(runtime, batch),
  }))
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
  results.forEach((result) => {
    for (const record of result.data?.items ?? []) {
      const target =
        record.objectType === undefined
          ? undefined
          : runtime.model.objects[record.objectType]
      if (!target) continue
      const previous = versions.get(record.id)
      if (previous && !isNewerOrEqualRecord(record, previous)) continue
      versions.set(record.id, record)
      labels.set(record.id, recordLabel(target, record))
      recordsById.set(record.id, {
        object: target,
        source: record,
        record: tableRecord(target, record),
      })
    }
  })
  return { labels, records: recordsById }
}
