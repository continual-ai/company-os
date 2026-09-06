import { type ListRequest, type Page, type PageToken } from "@company/runtime"
import { hashKey, useQueries } from "@tanstack/react-query"
import { useMemo, useState } from "react"

import { isNewerOrEqualRecord } from "@/model-cache"
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
  options: { window?: CollectionDateWindow | undefined; append?: boolean } = {}
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
  const requestKey = hashKey([object.id, request, options.append === true])
  const firstPage = {
    requestKey,
    list,
    index: 0,
    tokens: [undefined] as ReadonlyArray<PageToken | undefined>,
  }
  const [pagination, setPagination] = useState(firstPage)
  const activePage =
    pagination.requestKey === requestKey && pagination.list === list
      ? pagination
      : firstPage
  if (activePage !== pagination) setPagination(activePage)
  const pageIndex = activePage.index
  const pageToken = activePage.tokens[pageIndex]
  const queries = useQueries({
    queries: (options.append
      ? activePage.tokens.slice(0, pageIndex + 1)
      : [pageToken]
    ).map((token) =>
      list({ ...request, ...(token === undefined ? {} : { pageToken: token }) })
    ),
  })
  const page = queries.at(-1)!
  const records = useMemo(() => {
    const unique = new Map<string, ClientRecord>()
    for (const result of queries)
      for (const record of result.data?.items ?? noRecords) {
        const previous = unique.get(record.id)
        if (previous === undefined || isNewerOrEqualRecord(record, previous))
          unique.set(record.id, record)
      }
    return [...unique.values()]
  }, [queries])
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
  const nextPageToken = page.data?.nextPageToken ?? null
  const totalSize = queries[0]?.data?.totalSize ?? 0
  const loading = queries.some((result) => result.isFetching)
  const cause = queries.find((result) => result.error !== null)?.error
  const error =
    cause === undefined
      ? undefined
      : cause instanceof Error
        ? cause.message
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
    if (nextPageToken === null) return
    setPagination((current) => ({
      ...current,
      tokens: [...current.tokens.slice(0, current.index + 1), nextPageToken],
      index: current.index + 1,
    }))
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
    load: () => Promise.all(queries.map((result) => result.refetch())),
    loading,
    nextPage,
    pageIndex,
    previousPage: () =>
      setPagination((current) => ({
        ...current,
        index: Math.max(0, current.index - 1),
      })),
    records,
    referenceLabels,
    sorting,
    totalSize,
    update,
    updateCell,
    hasNextPage: nextPageToken !== null,
    hasPreviousPage: options.append !== true && pageIndex > 0,
  } as const
}
