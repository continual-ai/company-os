// Model authors retain precise service types; transport projections need one
// checked dynamic dispatch seam because model operation IDs are runtime data.
import type { Effect } from "effect"

import { type Action } from "#/runtime/model/definition/action.ts"
import {
  type ModelCatalog,
  modelObjects,
} from "#/runtime/model/definition/model.ts"
import type { ObjectType } from "#/runtime/model/definition/object.ts"
import { type CustomQuery } from "#/runtime/model/definition/query.ts"
import {
  type InferInputSchema,
  type InferSchema,
} from "#/runtime/model/definition/schema.ts"
import type {
  LinkListInput,
  LinkMutationInput,
} from "#/runtime/model/link-input.ts"
import {
  executableModelOperations,
  type ExecutableModelOperation,
} from "#/runtime/model/operations.ts"
import type { CurrentInvocation } from "#/runtime/server/invocation.ts"
import type { Links } from "#/runtime/server/model/link-service.ts"
import type { ObjectService } from "#/runtime/server/model/object-service.ts"

type LinkOperations = Pick<typeof Links.Service, "link" | "list" | "unlink">

type CustomOperations<TObject extends ObjectType> = TObject["actions"] &
  TObject["queries"]

export type CustomOperationService<
  TObject extends ObjectType,
  R = CurrentInvocation,
> = {
  readonly [
    TAction in CustomOperations<TObject>[keyof CustomOperations<TObject>] as TAction extends
      | Action
      | CustomQuery
      ? TAction["id"] extends "batchDelete" | "create" | "delete" | "update"
        ? never
        : TAction["id"]
      : never
  ]: TAction extends Action | CustomQuery
    ? (
        input: InferInputSchema<TAction["input"]>
      ) => Effect.Effect<InferSchema<TAction["output"]>, unknown, R>
    : never
}

/** Standard operations, including declared Link initialization and deltas, plus custom queries and actions for one object. */
type ObjectImplementation<TObject extends ObjectType> = ObjectService<TObject> &
  CustomOperationService<TObject>

export type ModelServiceMap<TModel extends ModelCatalog> = {
  readonly [
    TObjectId in keyof TModel["objects"]
  ]: TModel["objects"][TObjectId] extends ObjectType
    ? ObjectImplementation<TModel["objects"][TObjectId]>
    : never
}

/** A portable model exhaustively bound to its existing governed services. */
export interface ModelImplementation<TModel extends ModelCatalog> {
  readonly links: LinkOperations
  readonly model: TModel
  readonly services: ModelServiceMap<TModel>
}

function operation(service: object, name: string): unknown {
  // This is the single runtime validation seam for the declarative service map.
  return Reflect.get(service, name)
}

/** Validates and binds a closed model to the services that already execute it. */
export function implementModel<TModel extends ModelCatalog>(
  model: TModel,
  services: ModelServiceMap<TModel>,
  links: LinkOperations
): ModelImplementation<TModel> {
  const descriptors = executableModelOperations(model)
  for (const object of modelObjects(model)) {
    // SAFETY: model object IDs are exactly the keys required by ModelServiceMap.
    const service = services[object.id as keyof typeof services]
    if (service === undefined) {
      throw new Error(`Object '${object.id}' has no service implementation.`)
    }

    for (const descriptor of descriptors.filter(
      ({ linkTraversal, object: candidate }) =>
        linkTraversal === undefined && candidate.id === object.id
    )) {
      if (typeof operation(service, descriptor.definition.id) !== "function") {
        throw new Error(
          `${descriptor.definition.kind === "query" ? "Query" : "Action"} '${descriptor.key}' has no implementation.`
        )
      }
    }
  }

  return { links, model, services }
}

/** Internal dynamic dispatch used by transport projections after model validation. */
export function modelOperation(
  implementation: {
    readonly services: Readonly<Record<string, object>>
  },
  objectType: string,
  operationId: string
): (input: unknown) => Effect.Effect<unknown, unknown, CurrentInvocation> {
  const service = implementation.services[objectType]
  const method =
    service === undefined ? undefined : operation(service, operationId)
  if (typeof method !== "function") {
    throw new Error(
      `Operation '${objectType}.${operationId}' has no implementation.`
    )
  }
  // SAFETY: implementModel validated this model-derived operation as a method.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return method.bind(service) as (
    input: unknown
  ) => Effect.Effect<unknown, unknown, CurrentInvocation>
}

/** Dispatches an already validated object or Link operation. */
export function executeModelOperation(
  implementation: {
    readonly links: LinkOperations
    readonly services: Readonly<Record<string, object>>
  },
  descriptor: ExecutableModelOperation,
  input: unknown
): Effect.Effect<unknown, unknown, CurrentInvocation> {
  const traversal = descriptor.linkTraversal
  if (traversal === undefined) {
    return modelOperation(
      implementation,
      descriptor.object.id,
      descriptor.definition.id
    )(input)
  }
  if (descriptor.definition.id === "list") {
    // SAFETY: each protocol compiler decoded input from this generated list operation.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return implementation.links.list(traversal, input as LinkListInput)
  }
  // SAFETY: each protocol compiler decoded input from this generated mutation.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const mutation = input as LinkMutationInput
  return descriptor.definition.id === "link"
    ? implementation.links.link(traversal, mutation)
    : implementation.links.unlink(traversal, mutation)
}
