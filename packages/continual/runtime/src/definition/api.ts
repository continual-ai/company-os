import { definitionId } from "./identity"
import type { DefinedModule } from "./module"
import { objectOperationNames } from "./object"

export interface DefinedApi<
  TId extends string = string,
  TModules extends ReadonlyArray<DefinedModule> = ReadonlyArray<DefinedModule>,
> {
  id: TId
  kind: "api"
  modules: TModules
  name: string
}

export function defineApi<
  const TId extends string,
  const TModules extends ReadonlyArray<DefinedModule>,
>(definition: {
  id: TId
  modules: TModules
  name: string
}): DefinedApi<TId, TModules> {
  const moduleIds = definition.modules.map((module) => module.id)
  const duplicateModule = moduleIds.find(
    (id, index) => moduleIds.indexOf(id) !== index
  )

  if (duplicateModule) {
    throw new Error(
      `Module id '${duplicateModule}' is registered more than once.`
    )
  }

  const objects = definition.modules.flatMap((module) => module.objects)
  const actions = definition.modules.flatMap((module) => module.actions)
  const ids = objects.map((object) => object.id)
  const duplicate = ids.find((id, index) => ids.indexOf(id) !== index)

  if (duplicate) {
    throw new Error(`Object id '${duplicate}' is registered more than once.`)
  }

  const collections = objects.map((object) => object.collection)
  const duplicateCollection = collections.find(
    (collection, index) => collections.indexOf(collection) !== index
  )

  if (duplicateCollection) {
    throw new Error(
      `Object collection '${duplicateCollection}' is registered more than once.`
    )
  }

  const actionIds = actions.map((action) => action.id)
  const duplicateAction = actionIds.find(
    (id, index) => actionIds.indexOf(id) !== index
  )

  if (duplicateAction) {
    throw new Error(
      `Action id '${duplicateAction}' is registered more than once.`
    )
  }

  const objectIds = new Set(ids)
  const unboundAction = actions.find(
    (action) => !objectIds.has(action.subjectId)
  )

  if (unboundAction) {
    throw new Error(
      `Action '${unboundAction.id}' targets object '${unboundAction.subjectId}', which is not registered in API '${definition.id}'.`
    )
  }

  const actionMethods = actions.map(
    (action) => `${action.subjectId}.${action.verb}`
  )
  const duplicateMethod = actionMethods.find(
    (method, index) => actionMethods.indexOf(method) !== index
  )

  if (duplicateMethod) {
    throw new Error(
      `Action verb '${duplicateMethod}' is registered more than once in API '${definition.id}'.`
    )
  }

  const reservedMethod = actions.find((action) =>
    objectOperationNames.some((operation) => operation === action.verb)
  )

  if (reservedMethod) {
    throw new Error(
      `Action '${reservedMethod.id}' uses reserved object method '${reservedMethod.verb}'.`
    )
  }

  return {
    kind: "api",
    ...definition,
    id: definitionId(definition.id),
  }
}
