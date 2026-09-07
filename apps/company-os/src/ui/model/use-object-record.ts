import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"

import { useCapabilities } from "@/ui/application/use-capabilities"

import {
  objectCapabilityCheck,
  objectCapabilityChecks,
} from "./object-capabilities"
import { clientFor, type ModelObject } from "./object-client"
import type { ObjectFormInput } from "./object-form"
import { useObjectReferences } from "./object-references"

export function useObjectRecord(object: ModelObject, recordId: string) {
  const client = useMemo(() => clientFor(object), [object])
  const query = useMemo(() => client.get({ id: recordId }), [client, recordId])
  const record = useQuery(query)
  const references = useObjectReferences(
    object,
    record.data === undefined ? [] : [record.data]
  )
  const checks = useMemo(
    () => objectCapabilityChecks(object, [recordId]),
    [object, recordId]
  )
  const capabilities = useCapabilities(checks)
  return {
    can: (actionId: string) => {
      const check = objectCapabilityCheck(object, actionId, recordId)
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
