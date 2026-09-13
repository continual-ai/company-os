import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"

import {
  isUnavailable,
  queryErrorMessage,
} from "#/runtime/client/query-errors.ts"
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
  const result = useQuery(query)
  const record = isUnavailable(result.error) ? undefined : result.data
  const references = useObjectReferences(
    object,
    record === undefined ? [] : [record]
  )
  return {
    canDelete:
      record !== undefined &&
      client.batchDelete !== undefined &&
      objectActionAvailable(runtime.model, object, "delete", record),
    can: (actionId: string) =>
      record !== undefined &&
      objectActionAvailable(runtime.model, object, actionId, record),
    error: queryErrorMessage(result.error),
    isPending: result.isPending,
    isFetching: result.isFetching,
    reload: () => result.refetch(),
    record,
    referenceLabels: references.labels,
    references: references.records,
    deleteRecord: async () => {
      if (
        record === undefined ||
        client.batchDelete === undefined ||
        !objectActionAvailable(runtime.model, object, "delete", record)
      )
        throw new Error("Deletion is not available.")
      await client.batchDelete({ ids: [record.id] })
    },
    update: async (changes: ObjectFormInput) => {
      if (record === undefined || client.update === undefined)
        throw new Error("Updates are not available.")
      await client.update({
        etag: record.etag,
        ...changes,
        id: record.id,
      })
    },
  } as const
}
