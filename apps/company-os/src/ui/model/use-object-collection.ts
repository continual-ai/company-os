import { type ListRequest, type Page } from "@company/runtime"
import { hashKey, useInfiniteQuery } from "@tanstack/react-query"
import { useMemo } from "react"

import { isNewerOrEqualRecord } from "@/model-cache"
import { modelCollectionQuery } from "@/model-collection-query"
import type { ModelQueryOptions } from "@/model-query-client"
import { useCapabilities } from "@/ui/application/use-capabilities"

import type { CollectionDateWindow } from "./collection-dates"
import { objectCapabilityCheck } from "./object-capabilities"
import { clientFor, type ClientRecord, type ModelObject } from "./object-client"
import { objectListRequest } from "./object-collection-query"
import type {
  ObjectCollectionFilter,
  ObjectCollectionSort,
} from "./object-collection-view"
import type { ObjectFormInput } from "./object-form"
import type { ObjectTableValue } from "./object-table/object-table-config"
import { useReferenceLabels } from "./reference-labels"

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
  const client = useMemo(() => clientFor(object), [object])
  const list = listRecords ?? client.list
  const request = objectListRequest(
    object,
    columnFilters,
    sorting,
    undefined,
    options.window
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
  const referenceLabels = useReferenceLabels(object, records)
  const checks = useMemo(
    () =>
      Object.keys(object.actions).flatMap((action) => {
        const check = objectCapabilityCheck(object, action)
        return check === undefined ? [] : [check]
      }),
    [object]
  )
  const capabilities = useCapabilities(checks)
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

  const can = (actionId: string, target?: string) => {
    const check = objectCapabilityCheck(object, actionId, target)
    if (target !== undefined) {
      if (actionId === "get") return true
      const general = objectCapabilityCheck(object, actionId)
      return general !== undefined && capabilities.can(general)
    }
    return check !== undefined && capabilities.can(check)
  }

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
    records,
    referenceLabels,
    sorting,
    totalSize,
    update,
    updateCell,
    hasNextPage: page.hasNextPage,
  } as const
}
