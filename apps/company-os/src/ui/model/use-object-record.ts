import { Effect } from "effect"
import { useMemo } from "react"

import { modelData } from "@/data-client"
import { useCapabilities } from "@/ui/application/use-capabilities"
import { useModelQuery } from "@/use-model-query"

import {
  objectCapabilityCheck,
  objectCapabilityChecks,
} from "./object-capabilities"
import { clientFor, type ModelObject } from "./object-client"
import type { ObjectFormInput } from "./object-form"
import { loadReferenceLabels } from "./reference-labels"

const noLabels: ReadonlyMap<string, string> = new Map()

export function useObjectRecord(object: ModelObject, recordId: string) {
  const client = useMemo(() => clientFor(object), [object])
  const query = useMemo(() => client.get({ id: recordId }), [client, recordId])
  const record = useModelQuery(query)
  const labelsQuery = useMemo(
    () =>
      query.pipe(
        Effect.flatMap((value) => loadReferenceLabels(object, [value]))
      ),
    [query, object]
  )
  const labels = useModelQuery(labelsQuery)
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
      record.error === undefined
        ? undefined
        : record.error instanceof Error
          ? record.error.message
          : "The record could not be loaded.",
    load: async () => {
      modelData().invalidate(["*"])
      await Effect.runPromise(query)
    },
    loading: record.loading,
    record: record.value,
    referenceLabels: labels.value ?? noLabels,
    update: async (changes: ObjectFormInput) => {
      if (record.value === undefined || client.update === undefined)
        throw new Error("Updates are not available.")
      await client.update({
        ...changes,
        etag: record.value.etag,
        id: record.value.id,
      })
    },
  } as const
}
