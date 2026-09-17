import { hashKey, useInfiniteQuery } from "@tanstack/react-query"
import { useMemo } from "react"

import { isNewerOrEqualRecord } from "#/runtime/client/model-cache.ts"
import type { modelPagedQuery } from "#/runtime/client/model-query-client.ts"
import {
  isUnavailable,
  queryErrorMessage,
} from "#/runtime/client/query-errors.ts"
import type { Page } from "#/runtime/model/index.ts"
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

export type ObjectCollectionList = ReturnType<
  typeof modelPagedQuery<Page<ClientRecord>>
>
const noRecords: ReadonlyArray<ClientRecord> = []

export function useObjectCollection(
  object: ModelObject,
  columnFilters: ReadonlyArray<ObjectCollectionFilter>,
  sorting: ReadonlyArray<ObjectCollectionSort>,
  listRecords?: ObjectCollectionList,
  options: {
    window?: CollectionDateWindow | undefined
    visibility?: Readonly<Record<string, boolean>>
  } = {}
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
    runtime.model,
    options.visibility ?? {}
  )
  const query = list.infiniteQueryOptions(request)
  const requestKey = hashKey(query.queryKey)
  const page = useInfiniteQuery(query)
  const data = isUnavailable(page.error) ? undefined : page.data
  const recordsById = useMemo(() => {
    const unique = new Map<string, ClientRecord>()
    for (const result of data?.pages ?? [])
      for (const record of result.items ?? noRecords) {
        const previous = unique.get(record.id)
        if (previous === undefined || isNewerOrEqualRecord(record, previous))
          unique.set(record.id, record)
      }
    return unique
  }, [data])
  const records = useMemo(() => [...recordsById.values()], [recordsById])
  const recordPages = useMemo(
    () => data?.pages.map((batch) => batch.items) ?? [],
    [data]
  )
  const references = useObjectReferencePages(
    object,
    recordPages,
    typeof request.expand === "object" ? Object.keys(request.expand) : undefined
  )
  const totalSize = data?.pages[0]?.totalSize ?? 0
  const error = queryErrorMessage(page.error)

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
    const record = recordsById.get(recordId)
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
      target === undefined ? undefined : recordsById.get(target)
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
    isPending: page.isPending,
    isFetching: page.isFetching,
    isFetchingNextPage: page.isFetchingNextPage,
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
