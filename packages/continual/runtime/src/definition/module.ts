import { definitionId } from "./identity"
import type { DefinedObject } from "./object"

export interface DefinedModule {
  id: string
  kind: "module"
  name: string
  objects: ReadonlyArray<DefinedObject>
}

export function defineModule(definition: {
  id: string
  name: string
  objects: ReadonlyArray<DefinedObject>
}): DefinedModule {
  return {
    kind: "module",
    ...definition,
    id: definitionId(definition.id),
  }
}
