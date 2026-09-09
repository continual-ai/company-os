import { createContext, useContext } from "react"

import type {
  ClientRecord,
  ModelObject,
} from "#/runtime/ui/model/object-client.ts"
import type { ObjectFormInput } from "#/runtime/ui/model/object-form.ts"

export interface ObjectCreateOptions {
  readonly initialValues?: ObjectFormInput | undefined
  readonly referenceLabels?: ReadonlyMap<string, string> | undefined
  readonly onCreated?: ((record: ClientRecord) => void) | undefined
}

export type OpenObjectCreate = (
  object: ModelObject,
  options?: ObjectCreateOptions
) => void

export const ObjectCreateContext = createContext<OpenObjectCreate | undefined>(
  undefined
)

/** Opens the shared model-generated creation flow, including nested creation. */
export function useObjectCreate(): OpenObjectCreate {
  const open = useContext(ObjectCreateContext)
  if (open === undefined) {
    throw new Error("useObjectCreate must be used within ObjectCreateProvider")
  }
  return open
}
