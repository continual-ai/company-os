import { Schema } from "effect"

import {
  linkListInputSchema,
  linkPageOutputSchema,
  objectBatchGetInputSchema,
  objectBatchOutputSchema,
  objectGetInputSchema,
  objectListInputSchema,
  objectPageOutputSchema,
  objectRecordOutputSchema,
  pageSizeSchema,
} from "#/runtime/contract/model-schemas.ts"
import {
  toEffectModelObjectCreateSchema,
  toEffectModelObjectUpdateSchema,
  toEffectOperationInput,
  toEffectRecordIdentifierSchema,
  toEffectSchema,
} from "#/runtime/contract/schema.ts"
import type { ModelAction } from "#/runtime/model/definition/action.ts"
import type { ErrorType } from "#/runtime/model/definition/error.ts"
import {
  modelObjectLinkTraversals,
  modelObjects,
  type ModelCatalog,
  type ModelLinkTraversal,
} from "#/runtime/model/definition/model.ts"
import type { ObjectType } from "#/runtime/model/definition/object.ts"
import type { Query, StandardQuery } from "#/runtime/model/definition/query.ts"
import { MAX_BATCH_DELETE_SIZE } from "#/runtime/model/definition/request.ts"
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

/** Complete, protocol-independent contract resolved against one composed model. */
export interface ModelOperation {
  readonly key: string
  readonly id: string
  readonly kind: "query" | "action"
  readonly scope: "object" | "collection" | "global"
  readonly name: string
  readonly description: string
  readonly moduleId: string
  readonly object: ObjectType | undefined
  readonly linkTraversal?: ModelLinkTraversal
  readonly input: Schema.Struct<
    Readonly<Record<string, Schema.Codec<unknown, unknown>>>
  >
  readonly output: Schema.Codec<unknown, unknown>
  readonly errors: ReadonlyArray<ErrorType>
  readonly destructive: boolean
  readonly idempotent: boolean
}

type Definition = ModelAction | Query | StandardQuery
const universalErrors = [
  UnauthenticatedError,
  PermissionDeniedError,
  InternalError,
  ValidationError,
]
const writeErrors = [AbortedError, AlreadyExistsError, FailedPreconditionError]

function operationErrors(definition: Definition): ReadonlyArray<ErrorType> {
  if ("input" in definition)
    return [
      ...universalErrors,
      ...(definition.scope === "object" ? [NotFoundError] : []),
      ...definition.errors,
    ]
  if (definition.kind === "query")
    return [
      ...universalErrors,
      ...(definition.id === "list" ? [] : [NotFoundError]),
    ]
  // Create can reference missing records through initial Links, just as update can.
  return [...universalErrors, ...writeErrors, NotFoundError]
}

function pascalCase(value: string): string {
  return value
    .replace(/(^|[^a-zA-Z0-9]+)([a-zA-Z0-9])/g, (_match, _prefix, char) =>
      char.toUpperCase()
    )
    .replace(/[^a-zA-Z0-9]/g, "")
}

function objectSchemas(
  model: ModelCatalog,
  object: ObjectType,
  definition: Exclude<Definition, { readonly input: unknown }>
) {
  const prefix = `${pascalCase(object.id)}${pascalCase(definition.id)}`
  const recordId = objectGetInputSchema(object).fields.id
  switch (definition.id) {
    case "get":
      return {
        input: objectGetInputSchema(object),
        output: objectRecordOutputSchema(object),
      }
    case "list":
      return {
        input: objectListInputSchema(object),
        output: objectPageOutputSchema(object),
      }
    case "batchGet":
      return {
        input: objectBatchGetInputSchema(object),
        output: objectBatchOutputSchema(object),
      }
    case "create":
      return {
        input: toEffectModelObjectCreateSchema(model, object),
        output: objectRecordOutputSchema(object),
      }
    case "update":
      return {
        input: Schema.Struct({
          id: recordId,
          ...toEffectModelObjectUpdateSchema(model, object).fields,
        }).annotate({ identifier: `${prefix}Input` }),
        output: objectRecordOutputSchema(object),
      }
    case "delete":
      return {
        input: Schema.Struct({
          id: recordId,
          etag: Schema.optionalKey(Schema.String.check(Schema.isNonEmpty())),
        }),
        output: Schema.Struct({}),
      }
    case "batchDelete":
      return {
        input: Schema.Struct({
          ids: Schema.Array(recordId).check(
            Schema.isMinLength(1),
            Schema.isMaxLength(MAX_BATCH_DELETE_SIZE)
          ),
        }).annotate({ identifier: `${prefix}Input` }),
        output: Schema.Struct({}),
      }
    default:
      throw new Error(
        `Unknown standard operation '${object.id}.${definition.id}'.`
      )
  }
}

function resolveOperations(model: ModelCatalog): ReadonlyArray<ModelOperation> {
  const standard = modelObjects(model).flatMap((object) => {
    const moduleId = Object.values(model.modules).find((module) =>
      module.objects.some((candidate) => candidate.id === object.id)
    )!.id
    const operations: ModelOperation[] = [
      ...Object.values(model.queries).filter(
        (query): query is StandardQuery =>
          query.objectType === object.id && !("input" in query)
      ),
      ...Object.values(object.actions),
    ].map((definition) => ({
      moduleId,
      key: `${object.id}.${definition.id}`,
      id: definition.id,
      kind: definition.kind,
      scope: definition.scope,
      name: definition.name,
      description: definition.description,
      object,
      ...objectSchemas(model, object, definition),
      errors: operationErrors(definition),
      destructive: definition.kind === "action" && definition.destructive,
      idempotent: definition.kind === "query" || definition.idempotent,
    }))
    for (const linkTraversal of modelObjectLinkTraversals(model, object)) {
      const { traversal, target, writable } = linkTraversal
      const common = {
        moduleId: Object.values(model.modules).find((module) =>
          module.links.includes(linkTraversal.link)
        )!.id,
        object,
        linkTraversal,
        scope: "object" as const,
        idempotent: true,
      }
      const id = toEffectRecordIdentifierSchema(object.id)
      operations.push({
        ...common,
        key: `${object.id}.${traversal.key}.list`,
        id: "list",
        kind: "query",
        name: `List ${traversal.label.toLowerCase()}`,
        description:
          traversal.description ?? `Lists ${traversal.label.toLowerCase()}.`,
        input: Schema.Struct({
          id,
          ...(linkListInputSchema(model, linkTraversal)?.fields ?? {
            pageSize: Schema.optionalKey(pageSizeSchema),
            pageToken: Schema.optionalKey(Schema.String),
          }),
        }),
        output: linkPageOutputSchema(model, linkTraversal),
        errors: [...universalErrors, NotFoundError],
        destructive: false,
      })
      if (!writable) continue
      for (const method of ["link", "unlink"] as const)
        operations.push({
          ...common,
          key: `${object.id}.${traversal.key}.${method}`,
          id: method,
          kind: "action",
          name: `${method === "link" ? "Link" : "Unlink"} ${traversal.label.toLowerCase()}`,
          description: `${method === "link" ? "Links" : "Unlinks"} ${traversal.label.toLowerCase()}.`,
          input: Schema.Struct({
            id,
            target: toEffectRecordIdentifierSchema(target.from.typeId),
          }),
          output: Schema.Struct({}),
          errors: [...universalErrors, ...writeErrors, NotFoundError],
          destructive: method === "unlink",
        })
    }
    return operations
  })
  const custom = Object.values(model.modules).flatMap((module) =>
    [...module.actions, ...module.queries].map(
      (definition): ModelOperation => ({
        ...definition,
        moduleId: module.id,
        object:
          definition.objectType === undefined
            ? undefined
            : model.objects[definition.objectType],
        input: toEffectOperationInput(definition.input).annotate({
          identifier: `${pascalCase(definition.key)}Input`,
          title: `${definition.name} input`,
        }),
        output: toEffectSchema(definition.output).annotate({
          identifier: `${pascalCase(definition.key)}Output`,
          title: `${definition.name} output`,
        }),
        errors: operationErrors(definition),
      })
    )
  )
  return [...standard, ...custom]
}

const catalogs = new WeakMap<
  ModelCatalog,
  ReadonlyMap<string, ModelOperation>
>()
function operationCatalog(model: ModelCatalog) {
  let catalog = catalogs.get(model)
  if (catalog === undefined) {
    catalog = new Map(
      resolveOperations(model).map((operation) => [operation.key, operation])
    )
    catalogs.set(model, catalog)
  }
  return catalog
}

/** Resolve once per composed model, sharing schema instances across every consumer. */
export function modelOperations(
  model: ModelCatalog
): ReadonlyArray<ModelOperation> {
  return [...operationCatalog(model).values()]
}

export function modelOperation(
  model: ModelCatalog,
  key: string
): ModelOperation {
  const operation = operationCatalog(model).get(key)
  if (operation === undefined)
    throw new Error(`Model operation '${key}' is unknown.`)
  return operation
}
