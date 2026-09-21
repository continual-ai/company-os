import { hashKey, useQueries } from "@tanstack/react-query"
import { useMemo } from "react"

import { isNewerOrEqualRecord } from "#/runtime/client/model-cache.ts"
import type { ObjectType } from "#/runtime/model/definition/object.ts"
import { MAX_PAGE_SIZE } from "#/runtime/model/index.ts"
import { linkPreview } from "#/runtime/model/record-links.ts"
import {
  recordBatchFor,
  recordLabel,
  type ClientRecord,
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
export function useObjectRecordReferences(
  object: ObjectType,
  records: ReadonlyArray<ClientRecord>
) {
  return useObjectRecordReferencePages(object, [records])
}

export function useObjectRecordReferencePages(
  object: ObjectType,
  pages: ReadonlyArray<ReadonlyArray<ClientRecord>>,
  links?: ReadonlyArray<string>
) {
  const batches = useMemo(
    () => pages.map((records) => records.map((record) => ({ object, record }))),
    [object, pages]
  )
  return useRecordReferenceBatches(batches, links)
}

type ReferenceItem = {
  readonly object: ObjectType
  readonly record: ClientRecord
}

/** Resolves a heterogeneous collection together, including audit actors. */
export function useRecordReferences(items: ReadonlyArray<ReferenceItem>) {
  return useRecordReferenceBatches([items])
}

/** Page-local requests retain their query keys when later pages introduce more references. */
function recordReferenceRequests(
  runtime: ModelUiRuntime,
  items: ReadonlyArray<ReferenceItem>,
  links?: ReadonlyArray<string>
) {
  const ids = new Set<string>()
  for (const { record } of items) {
    if (typeof record.createdBy === "string") ids.add(record.createdBy)
    if (typeof record.updatedBy === "string") ids.add(record.updatedBy)
    for (const [key, link] of Object.entries(record.links ?? {})) {
      if (links && !links.includes(key)) continue
      if (link && typeof link === "object" && ("id" in link || "items" in link))
        continue
      for (const id of linkPreview(link).ids) ids.add(id)
    }
  }
  return chunks([...ids].sort(), MAX_PAGE_SIZE).map((batch) => ({
    query: recordBatchFor(runtime, batch),
  }))
}

function useRecordReferenceBatches(
  batches: ReadonlyArray<ReadonlyArray<ReferenceItem>>,
  links?: ReadonlyArray<string>
) {
  const runtime = useModelRuntime()
  const requests = [
    ...new Map(
      batches
        .flatMap((items) => recordReferenceRequests(runtime, items, links))
        .map((request) => [hashKey(request.query.queryKey), request])
    ).values(),
  ]
  const results = useQueries({
    queries: requests.map(({ query }) => query),
    combine: (queries) => queries.map((query) => query.data?.items),
  })
  return useMemo(() => {
    const labels = new Map<string, string>()
    const recordsById = new Map<string, ObjectRecordPresentation>()
    const versions = new Map<string, ClientRecord>()
    const embedded = batches.flat().flatMap(({ record }) => [
      record,
      ...Object.values(record.links ?? {}).flatMap(
        (link): ReadonlyArray<ClientRecord> => {
          if (!link || typeof link === "string") return []
          if (isClientRecord(link)) return [link]
          if ("items" in link && Array.isArray(link.items))
            return link.items.filter(isClientRecord)
          return []
        }
      ),
    ])
    const recordGroups = [embedded, ...results.map((items) => items ?? [])]
    recordGroups.forEach((records) => {
      for (const record of records) {
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
          record,
        })
      }
    })
    return { labels, records: recordsById }
  }, [batches, results, runtime.model])
}

// Expanded records were validated by the transport; distinguish them from plural envelopes here.
function isClientRecord(value: unknown): value is ClientRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "objectType" in value &&
    typeof value.objectType === "string" &&
    "etag" in value &&
    typeof value.etag === "string"
  )
}
