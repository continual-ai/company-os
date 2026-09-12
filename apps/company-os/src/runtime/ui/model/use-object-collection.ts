import { hashKey, useInfiniteQuery } from "@tanstack/react-query"
import { useMemo } from "react"

import { isNewerOrEqualRecord } from "#/runtime/client/model-cache.ts"
import { modelCollectionQuery } from "#/runtime/client/model-collection-query.ts"
import type { ModelQueryOptions } from "#/runtime/client/model-query-client.ts"
import { type ListRequest, type Page } from "#/runtime/model/index.ts"
import type { CollectionDateWindow } from "#/runtime/ui/model/collection-dates.ts"
import type {
  ObjectCollectionFilter,
  ObjectCollectionSort,
} from "#/runtime/ui/model/collection-view.ts"
import { objectActionAvailable } from "#/runtime/ui/model/object-actions.ts"
import {
  clientFor,
  type ClientRecord,
  type ModelObject,
} from "#/runtime/ui/model/object-client.ts"
import { objectListRequest } from "#/runtime/ui/model/object-collection-query.ts"
import type { ObjectFormInput } from "#/runtime/ui/model/object-form.ts"
import { useObjectReferencePages } from "#/runtime/ui/model/object-references.ts"
import type { ObjectTableValue } from "#/runtime/ui/model/object-table/object-table-config.ts"
import { useModelRuntime } from "#/runtime/ui/model/runtime-context.tsx"

export type ObjectCollectionList = (
  request: ListRequest
) => ModelQueryOptions<Page<ClientRecord>>
const noRecords: ReadonlyArray<ClientRecord> = []

export function useObjectCollection(
  object: ModelObject,
  columnFilters: ReadonlyArray<ObjectCollectionFilter>,
  sorting: ReadonlyArray<ObjectCollectionSort>,
  listRecords?: ObjectCollectionList,
  options: { window?: CollectionDateWindow | undefined } = {}
) {
  const runtime = useModelRuntime()

  const client = useMemo(() => clientFor(runtime, object), [runtime, object])
  const list = listRecords ?? client.list
  const request = objectListRequest(
    object,
    columnFilters,
    sorting,
    undefined,
    options.window,
    runtime.model
  )
  const query = modelCollectionQuery(list, request)
  const requestKey = hashKey(query.queryKey)
  const page = useInfiniteQuery(query)
  const records = useMemo(() => {
    const unique = new Map<string, ClientRecord>()
    for (const result of page.data?.pages ?? [])
      for (const record of result.items ?? noRecords) {
        const previous = unique.get(record.id)
        if (previous === undefined || isNewerOrEqualRecord(record, previous))
          unique.set(record.id, record)
      }
    return [...unique.values()]
  }, [page.data])
  const recordPages = useMemo(
    () => page.data?.pages.map((batch) => batch.items) ?? [],
    [page.data]
  )
  const references = useObjectReferencePages(object, recordPages)
  const totalSize = page.data?.pages[0]?.totalSize ?? 0
  const loading = page.isFetching
  const error =
    page.error === null
      ? undefined
      : page.error instanceof Error
        ? page.error.message
        : "The operation failed."

  const update = async (record: ClientRecord, changes: ObjectFormInput) => {
    if (client.update === undefined)
      throw new Error("Updates are not available.")
    await client.update({ etag: record.etag, ...changes, id: record.id })
  }
  const updateCell = async (
    recordId: string,
    propertyId: string,
    value: ObjectTableValue
  ) => {
    const record = records.find((candidate) => candidate.id === recordId)
    if (record === undefined) throw new Error("The record is no longer loaded.")
    await update(record, { [propertyId]: value })
  }
  const deleteRecords = async (recordIds: ReadonlyArray<string>) => {
    if (client.batchDelete === undefined)
      throw new Error("Batch deletion is not available.")
    await client.batchDelete({ ids: recordIds })
  }
  const nextPage = () => {
    if (page.hasNextPage && !page.isFetching)
      void page.fetchNextPage({ cancelRefetch: false })
  }

  const can = (actionId: string, target?: string) =>
    objectActionAvailable(
      runtime.model,
      object,
      actionId,
      records.find((record) => record.id === target)
    )

  return {
    can,
    canCreate: client.create !== undefined && can("create"),
    canDelete: (recordId: string) =>
      client.batchDelete !== undefined && can("delete", recordId),
    canUpdate: (recordId: string) =>
      client.update !== undefined && can("update", recordId),
    columnFilters,
    deleteRecords,
    error,
    load: () =>
      page.isFetchNextPageError
        ? page.fetchNextPage({ cancelRefetch: false })
        : page.refetch(),
    loading,
    nextPage,
    requestKey,
    request,
    records,
    referenceLabels: references.labels,
    references: references.records,
    sorting,
    totalSize,
    update,
    updateCell,
    hasNextPage: page.hasNextPage,
  } as const
}
