import { hashKey } from "@tanstack/react-query"
import { useCallback, useMemo } from "react"

import type { modelPagedQuery } from "#/runtime/client/model-query-client.ts"
import { queryErrorMessage } from "#/runtime/client/query-errors.ts"
import type { ObjectType } from "#/runtime/model/definition/object.ts"
import type { ListRequest, Page } from "#/runtime/model/index.ts"
import type { CollectionPages } from "#/runtime/ui/model/collection-pages.tsx"
import { objectActionAvailable } from "#/runtime/ui/model/object-actions.ts"
import {
  clientFor,
  type ClientRecord,
} from "#/runtime/ui/model/object-client.ts"
import type { ObjectFormInput } from "#/runtime/ui/model/object-form.ts"
import type { ObjectTableValue } from "#/runtime/ui/model/object-table/object-table-config.ts"
import { useObjectRecordReferencePages } from "#/runtime/ui/model/record-references.ts"
import { useModelRuntime } from "#/runtime/ui/model/runtime-context.tsx"

export type ObjectCollectionList = ReturnType<
  typeof modelPagedQuery<Page<ClientRecord>>
>
export function useObjectCollection(
  object: ObjectType,
  request: ListRequest,
  pages: CollectionPages
) {
  const runtime = useModelRuntime()
  const client = useMemo(() => clientFor(runtime, object), [runtime, object])
  const { recordsById, records, recordPages } = pages
  const requestKey = hashKey([request])
  const referenceLinks = useMemo(
    () =>
      typeof request.expand === "object"
        ? Object.keys(request.expand)
        : undefined,
    [request.expand]
  )
  const references = useObjectRecordReferencePages(
    object,
    recordPages,
    referenceLinks
  )
  const error = queryErrorMessage(pages.error)

  const update = useCallback(
    async (record: ClientRecord, changes: ObjectFormInput) => {
      if (client.update === undefined)
        throw new Error("Updates are not available.")
      await client.update({ etag: record.etag, ...changes, id: record.id })
    },
    [client]
  )
  const updateCell = useCallback(
    async (recordId: string, propertyId: string, value: ObjectTableValue) => {
      const record = recordsById.get(recordId)
      if (record === undefined)
        throw new Error("The record is no longer loaded.")
      await update(record, { [propertyId]: value })
    },
    [recordsById, update]
  )
  const deleteRecords = useCallback(
    async (recordIds: ReadonlyArray<string>) => {
      if (client.batchDelete === undefined)
        throw new Error("Batch deletion is not available.")
      await client.batchDelete({ ids: recordIds })
    },
    [client]
  )
  const can = useCallback(
    (actionId: string, target?: string) =>
      objectActionAvailable(
        runtime.model,
        object,
        actionId,
        target === undefined ? undefined : recordsById.get(target)
      ),
    [runtime.model, object, recordsById]
  )
  const canDelete = useCallback(
    (recordId: string) =>
      client.batchDelete !== undefined && can("delete", recordId),
    [client, can]
  )
  const canUpdate = useCallback(
    (recordId: string) =>
      client.update !== undefined && can("update", recordId),
    [client, can]
  )

  return {
    ...pages,
    can,
    canCreate: client.create !== undefined && can("create"),
    canDelete,
    canUpdate,
    deleteRecords,
    error,
    requestKey,
    records,
    referenceLabels: references.labels,
    references: references.records,
    update,
    updateCell,
  } as const
}
