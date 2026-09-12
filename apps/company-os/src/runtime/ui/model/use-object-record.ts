import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"

import { objectActionAvailable } from "#/runtime/ui/model/object-actions.ts"
import {
  clientFor,
  type ModelObject,
} from "#/runtime/ui/model/object-client.ts"
import type { ObjectFormInput } from "#/runtime/ui/model/object-form.ts"
import { useObjectReferences } from "#/runtime/ui/model/object-references.ts"
import { useModelRuntime } from "#/runtime/ui/model/runtime-context.tsx"

export function useObjectRecord(object: ModelObject, recordId: string) {
  const runtime = useModelRuntime()

  const client = useMemo(() => clientFor(runtime, object), [runtime, object])
  const query = useMemo(() => client.get({ id: recordId }), [client, recordId])
  const record = useQuery(query)
  const references = useObjectReferences(
    object,
    record.data === undefined ? [] : [record.data]
  )
  return {
    canDelete:
      client.batchDelete !== undefined &&
      objectActionAvailable(runtime.model, object, "delete", record.data),
    can: (actionId: string) =>
      objectActionAvailable(runtime.model, object, actionId, record.data),
    error:
      record.error === null
        ? undefined
        : record.error instanceof Error
          ? record.error.message
          : "The record could not be loaded.",
    loading: record.isPending,
    reload: () => record.refetch(),
    record: record.data,
    referenceLabels: references.labels,
    references: references.records,
    deleteRecord: async () => {
      if (
        record.data === undefined ||
        client.batchDelete === undefined ||
        !objectActionAvailable(runtime.model, object, "delete", record.data)
      )
        throw new Error("Deletion is not available.")
      await client.batchDelete({ ids: [record.data.id] })
    },
    update: async (changes: ObjectFormInput) => {
      if (record.data === undefined || client.update === undefined)
        throw new Error("Updates are not available.")
      await client.update({
        etag: record.data.etag,
        ...changes,
        id: record.data.id,
      })
    },
  } as const
}
