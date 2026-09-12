// Model authors retain precise service types; transport projections need one
// checked dynamic dispatch seam because model operation IDs are runtime data.
import type { Effect } from "effect"

import {
  modelOperations,
  type ModelOperation,
} from "#/runtime/contract/operations.ts"
import { type Action } from "#/runtime/model/definition/action.ts"
import { type ModelCatalog } from "#/runtime/model/definition/model.ts"
import { type Query } from "#/runtime/model/definition/query.ts"
import {
  type InferInputSchema,
  type InferSchema,
} from "#/runtime/model/definition/schema.ts"
import type {
  LinkListInput,
  LinkMutationInput,
} from "#/runtime/model/link-input.ts"
import type { CurrentInvocation } from "#/runtime/server/invocation.ts"
import type { Links } from "#/runtime/server/model/link-service.ts"
import type { ObjectService } from "#/runtime/server/model/object-service.ts"

type LinkOperations = Pick<typeof Links.Service, "link" | "list" | "unlink">

export type CustomOperationService<
  Operations extends Action | Query,
  R = CurrentInvocation,
> = {
  readonly [O in Operations as O["id"]]: (
    input: InferInputSchema<O["input"]>
  ) => Effect.Effect<InferSchema<O["output"]>, unknown, R>
}

type CustomOperations<M extends ModelCatalog> = Extract<
  M["actions"][keyof M["actions"]] | M["queries"][keyof M["queries"]],
  Action | Query
>
export type ModelServiceMap<M extends ModelCatalog> = {
  readonly [
    O in M["objects"][keyof M["objects"]] as O["id"]
  ]: ObjectService<O> &
    CustomOperationService<
      Extract<CustomOperations<M>, { readonly objectType: O["id"] }>
    >
} & CustomOperationService<
  Extract<CustomOperations<M>, { readonly objectType: undefined }>
>

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
  const descriptors = modelOperations(model)
  for (const descriptor of descriptors) {
    if (descriptor.linkTraversal !== undefined) continue
    const service =
      descriptor.object === undefined
        ? services
        : Reflect.get(services, descriptor.object.id)
    if (
      typeof service !== "object" ||
      service === null ||
      typeof operation(service, descriptor.id) !== "function"
    ) {
      throw new Error(
        `${descriptor.kind === "query" ? "Query" : "Action"} '${descriptor.key}' has no implementation.`
      )
    }
  }

  return { links, model, services }
}

/** Internal dynamic dispatch used by transport projections after model validation. */
function serviceOperation(
  implementation: {
    readonly services: Readonly<Record<string, object>>
  },
  objectType: string | undefined,
  operationId: string
): (input: unknown) => Effect.Effect<unknown, unknown, CurrentInvocation> {
  const service =
    objectType === undefined
      ? implementation.services
      : implementation.services[objectType]
  const method =
    service === undefined ? undefined : operation(service, operationId)
  if (typeof method !== "function") {
    throw new Error(
      `Operation '${objectType === undefined ? operationId : `${objectType}.${operationId}`}' has no implementation.`
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
  descriptor: ModelOperation,
  input: unknown
): Effect.Effect<unknown, unknown, CurrentInvocation> {
  const traversal = descriptor.linkTraversal
  if (traversal === undefined) {
    return serviceOperation(
      implementation,
      descriptor.object?.id,
      descriptor.id
    )(input)
  }
  if (descriptor.id === "list") {
    // SAFETY: each protocol compiler decoded input from this generated list operation.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return implementation.links.list(traversal, input as LinkListInput)
  }
  // SAFETY: each protocol compiler decoded input from this generated mutation.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const mutation = input as LinkMutationInput
  return descriptor.id === "link"
    ? implementation.links.link(traversal, mutation)
    : implementation.links.unlink(traversal, mutation)
}
