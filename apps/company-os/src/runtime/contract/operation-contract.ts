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
} from "#/runtime/contract/model-schemas.ts"
import {
  recordBatchInput,
  recordBatchResult,
} from "#/runtime/contract/record-batch.ts"
import { createRecordSearchContract } from "#/runtime/contract/record-search.ts"
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
import { containsSecret } from "#/runtime/model/definition/schema.ts"
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
export interface OperationContract {
  readonly sensitive?: boolean
  readonly builtin?: "batchGetRecords" | "searchRecords"
  readonly key: string
  readonly id: string
  readonly kind: "query" | "action"
  readonly scope: "record" | "object" | "global"
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
      ...(definition.scope === "record" ? [NotFoundError] : []),
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
  const recordId = objectGetInputSchema(object, model).fields.id
  switch (definition.id) {
    case "get":
      return {
        input: objectGetInputSchema(object, model),
        output: objectRecordOutputSchema(object, model, true),
      }
    case "list":
      return {
        input: objectListInputSchema(object, model),
        output: objectPageOutputSchema(object, model),
      }
    case "batchGet":
      return {
        input: objectBatchGetInputSchema(object, model),
        output: objectBatchOutputSchema(object, model),
      }
    case "create":
      return {
        input: toEffectModelObjectCreateSchema(model, object),
        output: objectRecordOutputSchema(object, model),
      }
    case "update":
      return {
        input: Schema.Struct({
          id: recordId,
          ...toEffectModelObjectUpdateSchema(model, object).fields,
        }).annotate({ identifier: `${prefix}Input` }),
        output: objectRecordOutputSchema(object, model),
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

function resolveOperations(
  model: ModelCatalog
): ReadonlyArray<OperationContract> {
  const standard = modelObjects(model).flatMap((object) => {
    const moduleId = Object.values(model.modules).find((module) =>
      module.objects.some((candidate) => candidate.id === object.id)
    )!.id
    const operations: OperationContract[] = [
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
      sensitive:
        definition.kind === "action" &&
        Object.values(object.properties).some(containsSecret),
      errors: operationErrors(definition),
      destructive: definition.kind === "action" && definition.destructive,
      idempotent: definition.kind === "query" || definition.idempotent,
    }))
    for (const linkTraversal of modelObjectLinkTraversals(model, object)) {
      const { traversal, inverse, writable } = linkTraversal
      const common = {
        moduleId: Object.values(model.modules).find((module) =>
          module.links.includes(linkTraversal.link)
        )!.id,
        object,
        linkTraversal,
        scope: "record" as const,
        idempotent: true,
      }
      const id = toEffectRecordIdentifierSchema(object.id)
      const read = traversal.max === 1 ? "get" : "list"
      operations.push({
        ...common,
        key: `${object.id}.${traversal.key}.${read}`,
        id: read,
        kind: "query",
        name: `${read === "get" ? "Get" : "List"} ${traversal.label.toLowerCase()}`,
        description:
          traversal.description ?? `Lists ${traversal.label.toLowerCase()}.`,
        input:
          read === "get"
            ? Schema.Struct({
                id,
                expand: linkListInputSchema(model, linkTraversal).fields.expand,
              })
            : Schema.Struct({
                id,
                ...linkListInputSchema(model, linkTraversal).fields,
              }),
        output:
          read === "get"
            ? Schema.Struct({
                item: Schema.NullOr(
                  linkPageOutputSchema(model, linkTraversal).fields.items.value
                ),
              })
            : linkPageOutputSchema(model, linkTraversal),
        errors: [...universalErrors, NotFoundError],
        destructive: false,
      })
      if (!writable || traversal.max === 1) continue
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
            target: toEffectRecordIdentifierSchema(inverse.from.typeId),
            etag: Schema.optionalKey(Schema.String.check(Schema.isNonEmpty())),
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
      (definition): OperationContract => ({
        ...definition,
        sensitive:
          containsSecret(definition.input) || containsSecret(definition.output),
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
  const search = createRecordSearchContract(model)
  const records: ReadonlyArray<OperationContract> = [
    {
      builtin: "batchGetRecords",
      id: "batchGet",
      key: "records.batchGet",
      name: "Get records by ID",
      description:
        "Returns complete records in input order, deduplicated, with missingIds for unavailable records.",
      input: recordBatchInput,
      output: recordBatchResult(model),
      kind: "query",
      scope: "object",
      object: undefined,
      moduleId: "",
      destructive: false,
      idempotent: true,
      errors: universalErrors,
    },
    {
      builtin: "searchRecords",
      id: "search",
      key: "records.search",
      name: "Search records",
      description:
        "Searches indexed fields across active object types. Returns a standard page (items, nextPageToken, totalSize, totalSizeExact) of ranked SearchResult summaries with up to three plain-text snippets each. Continue with the same query and objectTypes; snippets are previews, not complete record fields.",
      input: search.input,
      output: search.result,
      kind: "query",
      scope: "object",
      object: undefined,
      moduleId: "",
      destructive: false,
      idempotent: true,
      errors: universalErrors,
    },
  ]
  return [...standard, ...custom, ...records]
}

const catalogs = new WeakMap<
  ModelCatalog,
  ReadonlyMap<string, OperationContract>
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
export function operationContracts(
  model: ModelCatalog
): ReadonlyArray<OperationContract> {
  return [...operationCatalog(model).values()]
}

export function modelOperation(
  model: ModelCatalog,
  key: string
): OperationContract {
  const operation = operationCatalog(model).get(key)
  if (operation === undefined)
    throw new Error(`Model operation '${key}' is unknown.`)
  return operation
}

/** One namespace projection for server methods and client adapters. Keys are validated model identifiers. */
export function projectOperations(
  contracts: ReadonlyArray<OperationContract>,
  project: (contract: OperationContract) => unknown
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const contract of contracts) {
    const path = contract.key.split(".")
    let group = result
    for (const key of path.slice(0, -1)) {
      const child = group[key]
      if (child === undefined) group[key] = {}
      else if (typeof child !== "object" || child === null)
        throw new Error(`Operation namespace '${key}' is occupied.`)
      // SAFETY: projection owns every namespace object; only final segments hold projected values.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      group = group[key] as Record<string, unknown>
    }
    group[path.at(-1)!] = project(contract)
  }
  return result
}
