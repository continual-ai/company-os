import { type ListRequest, type Page, type PageToken } from "@company/runtime"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"

import { modelData } from "@/data-client"
import type { ModelQueryOptions } from "@/model-query-client"
import { useCapabilities } from "@/ui/application/use-capabilities"

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
  listRecords?: ObjectCollectionList
) {
  const client = useMemo(() => clientFor(object), [object])
  const list = listRecords ?? client.list
  const [pagination, setPagination] = useState({
    columnFilters,
    sorting,
    list,
    index: 0,
    tokens: [undefined] as ReadonlyArray<PageToken | undefined>,
  })
  if (
    pagination.columnFilters !== columnFilters ||
    pagination.sorting !== sorting ||
    pagination.list !== list
  )
    setPagination({
      columnFilters,
      sorting,
      list,
      index: 0,
      tokens: [undefined],
    })
  const pageIndex = pagination.index
  const pageToken = pagination.tokens[pageIndex]
  const setPageTokens = (
    update: (
      tokens: ReadonlyArray<PageToken | undefined>
    ) => ReadonlyArray<PageToken | undefined>
  ) =>
    setPagination((current) => ({ ...current, tokens: update(current.tokens) }))
  const setPageIndex = (update: (index: number) => number) =>
    setPagination((current) => ({ ...current, index: update(current.index) }))
  const pageQuery = useMemo(
    () => list(objectListRequest(object, columnFilters, sorting, pageToken)),
    [list, object, columnFilters, sorting, pageToken]
  )
  const page = useQuery(pageQuery)
  const referenceLabels = useReferenceLabels(
    object,
    page.data?.items ?? noRecords
  )
  const cache = useQueryClient()
  const checks = useMemo(
    () =>
      Object.keys(object.actions).flatMap((action) => {
        const check = objectCapabilityCheck(object, action)
        return check === undefined ? [] : [check]
      }),
    [object]
  )
  const capabilities = useCapabilities(checks)
  const records = page.data?.items ?? noRecords
  const nextPageToken = page.data?.nextPageToken ?? null
  const totalSize = page.data?.totalSize ?? 0
  const loading = page.isPending
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
    if (client.batchDelete !== undefined) {
      await client.batchDelete({ ids: recordIds })
    } else if (client.delete !== undefined) {
      await Promise.all(
        recordIds.map((id) => {
          const record = records.find((candidate) => candidate.id === id)
          return record === undefined
            ? client.delete!({ id })
            : client.delete!({ etag: record.etag, id })
        })
      )
    } else {
      throw new Error("Deletion is not available.")
    }
  }
  const nextPage = () => {
    if (nextPageToken === null) return
    setPageTokens((current) => [
      ...current.slice(0, pageIndex + 1),
      nextPageToken,
    ])
    setPageIndex((current) => current + 1)
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
      (client.delete !== undefined || client.batchDelete !== undefined) &&
      can("delete", recordId),
    canUpdate: (recordId: string) =>
      client.update !== undefined && can("update", recordId),
    columnFilters,
    deleteRecords,
    error,
    load: async () => {
      modelData().invalidate(["*"])
      await cache.fetchQuery(pageQuery)
    },
    loading,
    nextPage,
    pageIndex,
    previousPage: () => setPageIndex((current) => Math.max(0, current - 1)),
    records,
    referenceLabels,
    sorting,
    totalSize,
    update,
    updateCell,
    hasNextPage: nextPageToken !== null,
    hasPreviousPage: pageIndex > 0,
  } as const
}
