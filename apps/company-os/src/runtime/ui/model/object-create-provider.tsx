import { useCallback, useRef, useState, type ReactNode } from "react"

import {
  clientFor,
  type ClientRecord,
  type ModelObject,
} from "#/runtime/ui/model/object-client.ts"
import {
  ObjectCreateContext,
  type ObjectCreateOptions,
} from "#/runtime/ui/model/object-create-context.ts"
import { ObjectRecordDialog } from "#/runtime/ui/model/object-record-dialog.tsx"
import { useModelRuntime } from "#/runtime/ui/model/runtime-context.tsx"

interface ObjectCreateRequest extends ObjectCreateOptions {
  readonly id: number
  readonly object: ModelObject
}

const emptyReferenceLabels = new Map<string, string>()

/** Owns one composable stack of model-generated object creation dialogs. */
export function ObjectCreateProvider({
  children,
}: {
  readonly children: ReactNode
}) {
  const runtime = useModelRuntime()

  const nextId = useRef(0)
  const [requests, setRequests] = useState<ReadonlyArray<ObjectCreateRequest>>(
    []
  )

  const open = useCallback(
    (object: ModelObject, options: ObjectCreateOptions = {}) => {
      if (clientFor(runtime, object).create === undefined) {
        throw new Error(`Creation is not available for '${object.id}'.`)
      }
      const request: ObjectCreateRequest = {
        id: ++nextId.current,
        object,
        ...options,
      }
      setRequests((current) => [...current, request])
    },
    [runtime]
  )

  const close = (id: number) => {
    setRequests((current) => {
      const index = current.findIndex((request) => request.id === id)
      return index === -1 ? current : current.slice(0, index)
    })
  }

  return (
    <ObjectCreateContext.Provider value={open}>
      {children}
      {requests.map((request) => (
        <ObjectRecordDialog
          key={request.id}
          mode="create"
          object={request.object}
          initialValues={request.initialValues}
          open
          onOpenChange={(nextOpen) => !nextOpen && close(request.id)}
          onSave={async (input) => {
            const create = clientFor(runtime, request.object).create
            if (create === undefined) {
              throw new Error(
                `Creation is not available for '${request.object.id}'.`
              )
            }
            const record: ClientRecord = await create(input)
            request.onCreated?.(record)
            close(request.id)
          }}
          referenceLabels={request.referenceLabels ?? emptyReferenceLabels}
        />
      ))}
    </ObjectCreateContext.Provider>
  )
}
