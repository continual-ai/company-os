import { Model } from "@company/model"
import { MAX_PAGE_SIZE, type PageToken } from "@company/runtime"
import {
  functionalUpdate,
  type ColumnFiltersState,
  type OnChangeFn,
  type SortingState,
} from "@tanstack/react-table"
import { Effect } from "effect"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { capabilityKey, MAX_CAPABILITY_CHECKS } from "@/capabilities"
import { companyApi } from "@/company-client"
import { PLATFORM_ID } from "@/system-records"

import {
  allowedCapabilityKeys,
  objectCapabilityCheck,
  objectCapabilityChecks,
} from "./object-capabilities"
import {
  clientFor,
  recordLabel,
  recordObjectTypes,
  type ClientRecord,
  type ModelObject,
} from "./object-client"
import { objectListRequest } from "./object-collection-query"
import type { ObjectFormInput } from "./object-form"
import { objectTablePropertySchema } from "./object-table/object-table-cell-types"
import type { ObjectTableValue } from "./object-table/object-table-config"

function chunks<T>(values: ReadonlyArray<T>, size: number): ReadonlyArray<T[]> {
  const result: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size))
  }
  return result
}

async function loadReferenceLabels(
  object: ModelObject,
  records: ReadonlyArray<ClientRecord>
): Promise<ReadonlyMap<string, string>> {
  const references = new Map<string, Set<string>>()
  const addReferences = (typeId: string, ids: ReadonlyArray<string>) => {
    const values = references.get(typeId) ?? new Set<string>()
    for (const id of ids) values.add(id)
    references.set(typeId, values)
  }

  if (object.parent.kind !== "root") {
    addReferences(
      object.parent.typeId,
      records.flatMap((record) =>
        record.parent === undefined ? [] : [record.parent]
      )
    )
  }
  for (const [propertyId, property] of Object.entries(object.properties)) {
    const propertySchema = objectTablePropertySchema(property)
    if (propertySchema.kind !== "recordId") continue
    addReferences(
      propertySchema.typeId,
      records.flatMap((record) => {
        const value = record[propertyId]
        // The client record is the parsed API representation; references are
        // the string member of its closed value union.
        // oxlint-disable-next-line anti-slop/no-runtime-typeof
        return typeof value === "string" ? [value] : []
      })
    )
  }

  const labels = new Map<string, string>([[PLATFORM_ID, Model.root.name]])
  await Promise.all(
    [...references].flatMap(([typeId, values]) =>
      recordObjectTypes(typeId).flatMap((referencedObject) =>
        chunks(
          [...values].filter((id) => id !== PLATFORM_ID),
          MAX_PAGE_SIZE
        ).map(async (ids) => {
          if (ids.length === 0) return
          const page = await clientFor(referencedObject).list({
            filter: { field: "id", operator: "in", value: ids },
            pageSize: MAX_PAGE_SIZE,
          })
          for (const record of page.items) {
            labels.set(record.id, recordLabel(referencedObject, record))
          }
        })
      )
    )
  )
  return labels
}

export function useObjectCollection(object: ModelObject) {
  const client = useMemo(() => clientFor(object), [object])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [sorting, setSorting] = useState<SortingState>([])
  const [pageIndex, setPageIndex] = useState(0)
  const [pageTokens, setPageTokens] = useState<
    ReadonlyArray<PageToken | undefined>
  >([undefined])
  const [nextPageToken, setNextPageToken] = useState<PageToken | "">("")
  const [records, setRecords] = useState<ReadonlyArray<ClientRecord>>([])
  const [allowedCapabilities, setAllowedCapabilities] = useState<
    ReadonlySet<string>
  >(new Set())
  const [referenceLabels, setReferenceLabels] = useState<
    ReadonlyMap<string, string>
  >(new Map([[PLATFORM_ID, Model.root.name]]))
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(true)
  const requestId = useRef(0)
  const pageToken = pageTokens[pageIndex]

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current
    setLoading(true)
    setError(undefined)
    setAllowedCapabilities(new Set())
    try {
      const page = await client.list(
        objectListRequest(object, columnFilters, sorting, pageToken)
      )
      const checks = objectCapabilityChecks(
        object,
        page.items.map(({ id }) => id)
      )
      const [labels, capabilityResults] = await Promise.all([
        loadReferenceLabels(object, page.items),
        checks.length === 0
          ? Promise.resolve([])
          : Promise.all(
              chunks(checks, MAX_CAPABILITY_CHECKS).map((batch) =>
                Effect.runPromise(
                  companyApi.capabilities.checkCapabilities({
                    payload: { checks: batch },
                  })
                )
              )
            ).then((responses) => responses.flatMap(({ results }) => results)),
      ])
      if (requestId.current !== currentRequest) return
      setRecords(page.items)
      setAllowedCapabilities(allowedCapabilityKeys(checks, capabilityResults))
      setNextPageToken(page.nextPageToken)
      setReferenceLabels(labels)
    } catch (cause) {
      if (requestId.current === currentRequest) {
        setError(
          cause instanceof Error ? cause.message : "The operation failed."
        )
      }
    } finally {
      if (requestId.current === currentRequest) setLoading(false)
    }
  }, [client, columnFilters, object, pageToken, sorting])

  useEffect(() => {
    void load()
  }, [load])

  const resetPagination = () => {
    setPageIndex(0)
    setPageTokens([undefined])
  }
  const onColumnFiltersChange: OnChangeFn<ColumnFiltersState> = (update) => {
    setColumnFilters((current) => functionalUpdate(update, current))
    resetPagination()
  }
  const onSortingChange: OnChangeFn<SortingState> = (update) => {
    setSorting((current) => functionalUpdate(update, current))
    resetPagination()
  }

  const create = async (input: ObjectFormInput) => {
    if (client.create === undefined)
      throw new Error("Creation is not available.")
    await client.create(input)
    await load()
  }
  const update = async (record: ClientRecord, changes: ObjectFormInput) => {
    if (client.update === undefined)
      throw new Error("Updates are not available.")
    await client.update({ ...changes, etag: record.etag, id: record.id })
    await load()
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
    await load()
  }
  const nextPage = () => {
    if (nextPageToken === "") return
    setPageTokens((current) => [
      ...current.slice(0, pageIndex + 1),
      nextPageToken,
    ])
    setPageIndex((current) => current + 1)
  }

  const can = (actionId: string, target?: string) => {
    const check = objectCapabilityCheck(object, actionId, target)
    return check !== undefined && allowedCapabilities.has(capabilityKey(check))
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
    create,
    deleteRecords,
    error,
    load,
    loading,
    nextPage,
    onColumnFiltersChange,
    onSortingChange,
    pageIndex,
    previousPage: () => setPageIndex((current) => Math.max(0, current - 1)),
    records,
    referenceLabels,
    sorting,
    update,
    updateCell,
    hasNextPage: nextPageToken !== "",
    hasPreviousPage: pageIndex > 0,
  } as const
}
