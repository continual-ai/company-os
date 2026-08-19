import type { DefinedAction } from "./action"
import { definitionId } from "./identity"
import type { DefinedObject } from "./object"

export interface DefinedModule<
  TId extends string = string,
  TObjects extends ReadonlyArray<DefinedObject> = ReadonlyArray<DefinedObject>,
  TActions extends ReadonlyArray<DefinedAction> = ReadonlyArray<DefinedAction>,
> {
  actions: TActions
  id: TId
  kind: "module"
  name: string
  objects: TObjects
}

export function defineModule<
  const TId extends string,
  const TObjects extends ReadonlyArray<DefinedObject>,
>(definition: {
  id: TId
  name: string
  objects: TObjects
}): DefinedModule<TId, TObjects, readonly []>
export function defineModule<
  const TId extends string,
  const TObjects extends ReadonlyArray<DefinedObject>,
  const TActions extends ReadonlyArray<DefinedAction>,
>(definition: {
  actions: TActions
  id: TId
  name: string
  objects: TObjects
}): DefinedModule<TId, TObjects, TActions>
export function defineModule(definition: {
  actions?: ReadonlyArray<DefinedAction>
  id: string
  name: string
  objects: ReadonlyArray<DefinedObject>
}): DefinedModule {
  const actions = definition.actions ?? []
  return {
    kind: "module",
    ...definition,
    actions,
    id: definitionId(definition.id),
  }
}
