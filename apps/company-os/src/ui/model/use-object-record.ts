import { useCallback, useEffect, useMemo, useState } from "react"

import { capabilityKey } from "@/capabilities"
import { loadAllowedCapabilities } from "@/ui/application/load-capabilities"

import {
  objectCapabilityCheck,
  objectCapabilityChecks,
} from "./object-capabilities"
import { clientFor, type ClientRecord, type ModelObject } from "./object-client"
import type { ObjectFormInput } from "./object-form"
import { loadReferenceLabels } from "./use-object-collection"

export function useObjectRecord(object: ModelObject, recordId: string) {
  const client = useMemo(() => clientFor(object), [object])
  const [record, setRecord] = useState<ClientRecord>()
  const [referenceLabels, setReferenceLabels] = useState<
    ReadonlyMap<string, string>
  >(new Map())
  const [allowedCapabilities, setAllowedCapabilities] = useState<
    ReadonlySet<string>
  >(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()

  const load = useCallback(async () => {
    setLoading(true)
    setError(undefined)
    try {
      const checks = objectCapabilityChecks(object, [recordId])
      const allowed = await loadAllowedCapabilities(checks)
      const getCheck = objectCapabilityCheck(object, "get", recordId)
      if (getCheck === undefined || !allowed.has(capabilityKey(getCheck))) {
        throw new Error(
          `You do not have access to this ${object.name.toLowerCase()}.`
        )
      }
      const batch = await client.batchGet({ ids: [recordId] })
      const nextRecord = batch.items[0]
      if (nextRecord === undefined) {
        throw new Error(`This ${object.name.toLowerCase()} does not exist.`)
      }
      const labels = await loadReferenceLabels(object, [nextRecord])
      setAllowedCapabilities(allowed)
      setRecord(nextRecord)
      setReferenceLabels(labels)
    } catch (cause) {
      setRecord(undefined)
      setAllowedCapabilities(new Set())
      setError(
        cause instanceof Error
          ? cause.message
          : "The record could not be loaded."
      )
    } finally {
      setLoading(false)
    }
  }, [client, object, recordId])

  useEffect(() => {
    void load()
  }, [load])

  const can = (actionId: string) => {
    const check = objectCapabilityCheck(object, actionId, recordId)
    return check !== undefined && allowedCapabilities.has(capabilityKey(check))
  }

  return {
    can,
    error,
    load,
    loading,
    record,
    referenceLabels,
    update: async (changes: ObjectFormInput) => {
      if (record === undefined || client.update === undefined) {
        throw new Error("Updates are not available.")
      }
      await client.update({ ...changes, etag: record.etag, id: record.id })
      await load()
    },
  } as const
}
