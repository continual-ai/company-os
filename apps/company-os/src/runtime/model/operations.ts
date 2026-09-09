// Model authors retain precise service types; transport projections need one
// checked dynamic dispatch seam because model operation IDs are runtime data.

import {
  type Action,
  isStandardActionId,
} from "#/runtime/model/definition/action.ts"
import type { ErrorType } from "#/runtime/model/definition/error.ts"
import {
  type ModelCatalog,
  type ModelLinkTraversal,
  modelObjectLinkTraversals,
  modelObjects,
} from "#/runtime/model/definition/model.ts"
import type { ObjectType } from "#/runtime/model/definition/object.ts"
import {
  type Query,
  type CustomQuery,
} from "#/runtime/model/definition/query.ts"
import { schema } from "#/runtime/model/definition/schema.ts"
import {
  AbortedError,
  AlreadyExistsError,
  FailedPreconditionError,
  InternalError,
  NotFoundError,
  PermissionDeniedError,
  UnauthenticatedError,
  ValidationError,
} from "#/runtime/model/definition/standard-error.ts"

export interface ExecutableModelOperation {
  readonly definition: Action | Query | CustomQuery
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
              id: schema.reference(object),
              target: schema.reference({
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

const objectOperationIndexes = new WeakMap<
  ModelCatalog,
  ReadonlyMap<string, ExecutableModelOperation>
>()

/** Resolves one object operation from the normalized closed-model catalog. */
export function executableModelOperation(
  model: ModelCatalog,
  objectType: string,
  operationId: string
): ExecutableModelOperation {
  let index = objectOperationIndexes.get(model)
  if (index === undefined) {
    index = new Map(
      executableModelOperations(model)
        .filter(({ linkTraversal }) => linkTraversal === undefined)
        .map((descriptor) => [descriptor.key, descriptor])
    )
    objectOperationIndexes.set(model, index)
  }
  const descriptor = index.get(`${objectType}.${operationId}`)
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
  if (definition.kind === "query" && "errors" in definition) {
    return [
      ...universalErrors,
      ...(definition.scope === "object" ? [NotFoundError] : []),
      ...definition.errors,
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
