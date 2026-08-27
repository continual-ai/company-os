/* oxlint-disable anti-slop/no-object-parameters, anti-slop/no-runtime-typeof, anti-slop/no-unknown-parameters, anti-slop/no-unknown-returns, anti-slop/no-unsafe-dictionary-type, typescript/no-unsafe-type-assertion */
// Model authors retain precise service types; transport projections need one
// checked dynamic dispatch seam because model operation IDs are runtime data.
import type { Effect } from "effect"

import {
  type Action,
  type ActionInput,
  type ActionOutput,
  isStandardActionId,
} from "./definition/action"
import type { ErrorType } from "./definition/error"
import {
  type ModelCatalog,
  type ModelLinkTraversal,
  modelObjectLinkTraversals,
  modelObjects,
} from "./definition/model"
import type { ObjectType } from "./definition/object"
import { type Query } from "./definition/query"
import { schema } from "./definition/schema"
import {
  AbortedError,
  AlreadyExistsError,
  FailedPreconditionError,
  InternalError,
  NotFoundError,
  PermissionDeniedError,
  UnauthenticatedError,
  ValidationError,
} from "./definition/standard-error"
import type { LinkService } from "./effect-link-service"
import type { LinkListInput, LinkMutationInput } from "./effect-link-service"
import type { CurrentInvocation, Service } from "./effect-object-service"

type CustomActionService<TObject extends ObjectType> = {
  readonly [
    TAction in TObject["actions"][keyof TObject["actions"]] as TAction extends Action
      ? TAction["id"] extends "batchDelete" | "create" | "delete" | "update"
        ? never
        : TAction["id"]
      : never
  ]: TAction extends Action
    ? (
        input: ActionInput<TAction>
      ) => Effect.Effect<ActionOutput<TAction>, unknown, CurrentInvocation>
    : never
}

/** Queries and actions that implement one object in a closed model. */
export type ObjectImplementation<TObject extends ObjectType> = Service<
  TObject,
  unknown,
  CurrentInvocation
> &
  CustomActionService<TObject>

export type ModelServiceMap<TModel extends ModelCatalog> = {
  readonly [
    TObjectId in keyof TModel["objects"]
  ]: TModel["objects"][TObjectId] extends ObjectType
    ? ObjectImplementation<TModel["objects"][TObjectId]>
    : never
}

/** A portable model exhaustively bound to its existing governed services. */
export interface ModelImplementation<TModel extends ModelCatalog> {
  readonly links: LinkService<unknown, CurrentInvocation>
  readonly model: TModel
  readonly services: ModelServiceMap<TModel>
}

export interface ExecutableModelOperation {
  readonly definition: Action | Query
  readonly key: string
  readonly linkTraversal?: ModelLinkTraversal
  readonly object: ObjectType
}

/** One normalized catalog consumed by binding and protocol projections. */
export function executableModelOperations(
  model: ModelCatalog
): ReadonlyArray<ExecutableModelOperation> {
  return modelObjects(model).flatMap((object) => {
    const objectOperations: ReadonlyArray<ExecutableModelOperation> = [
      ...Object.values(model.queries[object.id]!).map((definition) => ({
        definition,
        key: `${object.id}.${definition.id}`,
        object,
      })),
      ...Object.values(object.actions).map((definition) => ({
        definition,
        key: `${object.id}.${definition.id}`,
        object,
      })),
    ]
    const linkCapabilities = modelObjectLinkTraversals(model, object).flatMap(
      (linkTraversal): ReadonlyArray<ExecutableModelOperation> => {
        const prefix = `${object.id}.${linkTraversal.traversal.key}`
        const list: ExecutableModelOperation = {
          definition: {
            description:
              linkTraversal.traversal.description ??
              `Lists ${linkTraversal.traversal.label.toLowerCase()}.`,
            id: "list",
            kind: "query",
            name: `List ${linkTraversal.traversal.label.toLowerCase()}`,
            objectType: object.id,
            scope: "object",
          },
          key: `${prefix}.list`,
          linkTraversal,
          object,
        }
        if (!linkTraversal.writable) return [list]
        const mutation = (id: "link" | "unlink"): ExecutableModelOperation => ({
          definition: {
            description: `${id === "link" ? "Links" : "Unlinks"} ${linkTraversal.traversal.label.toLowerCase()}.`,
            destructive: id === "unlink",
            errors: [],
            id,
            idempotent: true,
            input: schema.object({
              id: schema.recordId(object),
              target: schema.recordId({
                id: linkTraversal.target.from.typeId,
              }),
            }),
            kind: "action",
            name: `${id === "link" ? "Link" : "Unlink"} ${linkTraversal.traversal.label.toLowerCase()}`,
            objectType: object.id,
            output: schema.object({}),
            scope: "object",
          },
          key: `${prefix}.${id}`,
          linkTraversal,
          object,
        })
        return linkTraversal.traversal.cardinality === "one" ||
          linkTraversal.target.cardinality === "one"
          ? [list, mutation("link")]
          : [list, mutation("link"), mutation("unlink")]
      }
    )
    return [...objectOperations, ...linkCapabilities]
  })
}

/** Resolves one operation from the normalized closed-model catalog. */
export function executableModelOperation(
  model: ModelCatalog,
  objectType: string,
  operationId: string
): ExecutableModelOperation {
  const descriptor = executableModelOperations(model).find(
    ({ definition, linkTraversal, object }) =>
      object.id === objectType &&
      linkTraversal === undefined &&
      definition.id === operationId
  )
  if (descriptor === undefined) {
    throw new Error(
      `Model operation '${objectType}.${operationId}' is unknown.`
    )
  }
  return descriptor
}

const universalErrors = [
  UnauthenticatedError,
  PermissionDeniedError,
  InternalError,
  ValidationError,
] as const

/** Exact public failures admitted by one normalized model operation. */
export function modelOperationErrors(
  descriptor: ExecutableModelOperation
): ReadonlyArray<ErrorType> {
  const { definition } = descriptor
  if (descriptor.linkTraversal !== undefined) {
    return definition.kind === "query"
      ? [...universalErrors, NotFoundError]
      : [
          ...universalErrors,
          AbortedError,
          AlreadyExistsError,
          FailedPreconditionError,
          NotFoundError,
        ]
  }
  if (definition.kind === "query") {
    return definition.id === "list"
      ? universalErrors
      : [...universalErrors, NotFoundError]
  }
  if (!isStandardActionId(definition.id)) {
    return [
      ...universalErrors,
      ...(definition.scope === "object" ? [NotFoundError] : []),
      ...definition.errors,
    ]
  }
  return [
    ...universalErrors,
    AbortedError,
    AlreadyExistsError,
    FailedPreconditionError,
    ...(definition.id === "create" ? [] : [NotFoundError]),
  ]
}

function operation(service: object, name: string): unknown {
  // This is the single runtime validation seam for the declarative service map.
  // SAFETY: callers only use model-derived operation IDs, validated below.
  return (service as Readonly<Record<string, unknown>>)[name]
}

/** Validates and binds a closed model to the services that already execute it. */
export function implementModel<TModel extends ModelCatalog>(
  model: TModel,
  services: ModelServiceMap<TModel>,
  links: LinkService<unknown, CurrentInvocation>
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
  return method.bind(service) as (
    input: unknown
  ) => Effect.Effect<unknown, unknown, CurrentInvocation>
}

/** Dispatches an already validated object or Link operation. */
export function executeModelOperation(
  implementation: {
    readonly links: LinkService<unknown, CurrentInvocation>
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
