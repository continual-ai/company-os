import { type ListRequest, type Page, type PageToken } from "@company/runtime"
import { useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"

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
  const pageQuery = useMemo(
    () => list(objectListRequest(object, columnFilters, sorting, pageToken)),
    [list, object, columnFilters, sorting, pageToken]
  )
  const page = useQuery(pageQuery)
  const referenceLabels = useReferenceLabels(
    object,
    page.data?.items ?? noRecords
  )
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
    load: () => page.refetch(),
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
    hasPreviousPage: pageIndex > 0,
  } as const
}
