import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"

import {
  objectCapabilityCheck,
  objectCapabilityChecks,
} from "#/runtime/ui/model/object-capabilities.ts"
import {
  clientFor,
  type ModelObject,
} from "#/runtime/ui/model/object-client.ts"
import type { ObjectFormInput } from "#/runtime/ui/model/object-form.ts"
import { useObjectReferences } from "#/runtime/ui/model/object-references.ts"
import { useModelRuntime } from "#/runtime/ui/model/runtime-context.tsx"
import { useCapabilities } from "#/runtime/ui/model/use-capabilities.ts"

export function useObjectRecord(object: ModelObject, recordId: string) {
  const runtime = useModelRuntime()

  const client = useMemo(() => clientFor(runtime, object), [runtime, object])
  const query = useMemo(() => client.get({ id: recordId }), [client, recordId])
  const record = useQuery(query)
  const references = useObjectReferences(
    object,
    record.data === undefined ? [] : [record.data]
  )
  const checks = useMemo(
    () => objectCapabilityChecks(runtime, object, [recordId]),
    [runtime, object, recordId]
  )
  const capabilities = useCapabilities(checks)
  return {
    can: (actionId: string) => {
      const check = objectCapabilityCheck(runtime, object, actionId, recordId)
      return check !== undefined && capabilities.can(check)
    },
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
