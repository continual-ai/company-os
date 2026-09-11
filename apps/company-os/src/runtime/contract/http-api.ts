// Effect's HttpApi builder is statically keyed while a Model is intentionally
// data-driven. This module contains the one dynamic bridge between them.
import { Effect, Schema } from "effect"
import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiMiddleware,
  HttpApiSchema,
  OpenApi,
} from "effect/unstable/httpapi"

import {
  customMethodApi,
  customMethodParameter,
  customMethodPath,
} from "#/runtime/contract/http-custom-method.ts"
import {
  httpEndpointId,
  linkHttpEndpointId,
} from "#/runtime/contract/http-endpoint.ts"
import {
  linkListInputSchema,
  linkPageOutputSchema,
  objectBatchGetInputSchema,
  objectBatchOutputSchema,
  objectListInputSchema,
  objectPageOutputSchema,
  objectRecordOutputSchema,
  pageSizeSchema,
} from "#/runtime/contract/model-schemas.ts"
import {
  schemaErrorToApiError,
  toEffectErrorSchema,
  toEffectInputSchema,
  toEffectModelObjectCreateSchema,
  toEffectModelObjectUpdateSchema,
  toEffectRecordIdentifierSchema,
  toEffectSchema,
} from "#/runtime/contract/schema.ts"
import {
  isStandardActionId,
  type Action,
} from "#/runtime/model/definition/action.ts"
import type {
  ErrorStatus,
  ErrorType,
} from "#/runtime/model/definition/error.ts"
import {
  modelObjectLinkTraversals,
  modelObjects,
  type ModelCatalog,
  type ModelLinkTraversal,
} from "#/runtime/model/definition/model.ts"
import { Etag, type ObjectType } from "#/runtime/model/definition/object.ts"
import {
  standardQueries,
  type CustomQuery,
  type Query,
} from "#/runtime/model/definition/query.ts"
import {
  MAX_BATCH_DELETE_SIZE,
  PageToken,
} from "#/runtime/model/definition/request.ts"
import { schema } from "#/runtime/model/definition/schema.ts"
import { ValidationError } from "#/runtime/model/definition/standard-error.ts"
import {
  executableModelOperations,
  modelOperationErrors,
  type ExecutableModelOperation,
} from "#/runtime/model/operations.ts"

export interface HttpApiOptions {
  readonly basePath?: `/${string}`
  readonly id?: string
  readonly version?: string
}

export interface ApiReference {
  readonly dispose: () => Promise<void>
  readonly handler: (request: Request) => Promise<Response>
}

type DynamicGroup = HttpApiGroup.HttpApiGroup<
  string,
  HttpApiEndpoint.Constraint,
  boolean
>
export type DynamicHttpApi = HttpApi.HttpApi<string, HttpApiGroup.Constraint>

const defaultBasePath = "/api/v1" as const

const httpStatusByErrorStatus = {
  ABORTED: 409,
  ALREADY_EXISTS: 409,
  CANCELLED: 499,
  DATA_LOSS: 500,
  DEADLINE_EXCEEDED: 504,
  FAILED_PRECONDITION: 400,
  INTERNAL: 500,
  INVALID_ARGUMENT: 400,
  NOT_FOUND: 404,
  OUT_OF_RANGE: 400,
  PERMISSION_DENIED: 403,
  RESOURCE_EXHAUSTED: 429,
  UNAUTHENTICATED: 401,
  UNAVAILABLE: 503,
  UNIMPLEMENTED: 501,
  UNKNOWN: 500,
} satisfies Readonly<Record<ErrorStatus, number>>

function pascalCase(value: string): string {
  return value
    .replace(/(^|[^a-zA-Z0-9]+)([a-zA-Z0-9])/g, (_match, _prefix, char) =>
      char.toUpperCase()
    )
    .replace(/[^a-zA-Z0-9]/g, "")
}

function pathParameter(object: ObjectType) {
  const name = "id"
  return {
    name,
    schema: Schema.Struct({
      [name]: toEffectRecordIdentifierSchema(object.id).annotate({
        title: `${object.name} ID or alias`,
      }),
    }),
  }
}

const pageTokenSchema = Schema.String.pipe(
  Schema.fromBrand("PageToken", PageToken)
)

const etagSchema = Schema.String.pipe(Schema.fromBrand("Etag", Etag)).annotate({
  title: "Entity tag",
})

const compiledErrorSchemas = new WeakMap<ErrorType, Schema.Top>()

function errorSchemas(errors: ReadonlyArray<ErrorType>) {
  const uniqueErrors = new Map(errors.map((error) => [error.reason, error]))
  return [...uniqueErrors.values()].map((error) => {
    const cached = compiledErrorSchemas.get(error)
    if (cached !== undefined) return cached

    const compiled = toEffectErrorSchema(error).pipe(
      HttpApiSchema.status(httpStatusByErrorStatus[error.status])
    )
    compiledErrorSchemas.set(error, compiled)
    return compiled
  })
}

const validationErrorSchema = errorSchemas([ValidationError])[0]!

function projectedErrorSchemas(
  object: ObjectType,
  definition: Action | Query | CustomQuery
) {
  return errorSchemas(
    modelOperationErrors({
      definition,
      key: `${object.id}.${definition.id}`,
      object,
    }).filter((error) => error.reason !== ValidationError.reason)
  )
}

export function linkDescriptor(
  model: ModelCatalog,
  object: ObjectType,
  traversal: ModelLinkTraversal,
  operation: "link" | "list" | "unlink"
): ExecutableModelOperation {
  const key = `${object.id}.${traversal.traversal.key}.${operation}`
  const descriptor = executableModelOperations(model).find(
    (candidate) => candidate.key === key
  )
  if (descriptor === undefined) {
    throw new Error(`Link operation '${key}' is not generated.`)
  }
  return descriptor
}

function addLinkEndpoints(
  group: DynamicGroup,
  model: ModelCatalog,
  object: ObjectType,
  basePath: `/${string}`
): DynamicGroup {
  let result = group
  for (const traversal of modelObjectLinkTraversals(model, object)) {
    const collectionPath =
      `${basePath}/${object.collection}/:id/${traversal.traversal.key}` as const
    const listDescriptor = linkDescriptor(model, object, traversal, "list")
    const listFields = linkListInputSchema(model, traversal)?.fields
    const listEndpoint = HttpApiEndpoint.get(
      linkHttpEndpointId("list", object, traversal),
      collectionPath,
      {
        params: Schema.Struct({
          id: toEffectRecordIdentifierSchema(object.id),
        }),
        query: {
          pageSize: Schema.optionalKey(pageSizeSchema),
          pageToken: Schema.optionalKey(pageTokenSchema),
          ...(listFields !== undefined
            ? {
                filter: Schema.optionalKey(
                  Schema.fromJsonString(Schema.requiredKey(listFields.filter))
                ),
                sort: Schema.optionalKey(
                  Schema.fromJsonString(Schema.requiredKey(listFields.sort))
                ),
              }
            : {}),
        },
        success: linkPageOutputSchema(model, traversal).annotate({
          identifier: `${pascalCase(object.id)}${pascalCase(traversal.traversal.key)}Page`,
        }),
        error: errorSchemas(modelOperationErrors(listDescriptor)),
      }
    ).annotateMerge(
      endpointAnnotations(
        traversal.traversal.description === undefined
          ? {
              identifier: linkHttpEndpointId("list", object, traversal),
              summary: `List ${traversal.traversal.label.toLowerCase()}`,
            }
          : {
              description: traversal.traversal.description,
              identifier: linkHttpEndpointId("list", object, traversal),
              summary: `List ${traversal.traversal.label.toLowerCase()}`,
            }
      )
    )
    result = result.add(listEndpoint)

    if (!traversal.writable) continue
    const mutationParams = (method: string) =>
      Schema.Struct({
        id: toEffectRecordIdentifierSchema(object.id),
        [method]: customMethodParameter(method),
      })
    const payload = Schema.Struct({
      target: toEffectRecordIdentifierSchema(traversal.target.from.typeId),
    })
    const linkActionDescriptor = linkDescriptor(
      model,
      object,
      traversal,
      "link"
    )
    result = result.add(
      HttpApiEndpoint.post(
        linkHttpEndpointId("link", object, traversal),
        customMethodPath(collectionPath, "link"),
        {
          params: mutationParams("link"),
          payload,
          success: HttpApiSchema.NoContent,
          error: errorSchemas(modelOperationErrors(linkActionDescriptor)),
        }
      ).annotateMerge(
        endpointAnnotations({
          identifier: linkHttpEndpointId("link", object, traversal),
          summary: `Link ${traversal.traversal.label.toLowerCase()}`,
        })
      )
    )

    const unlinkDescriptor = linkDescriptor(model, object, traversal, "unlink")
    result = result.add(
      HttpApiEndpoint.post(
        linkHttpEndpointId("unlink", object, traversal),
        customMethodPath(collectionPath, "unlink"),
        {
          params: mutationParams("unlink"),
          payload,
          success: HttpApiSchema.NoContent,
          error: errorSchemas(modelOperationErrors(unlinkDescriptor)),
        }
      ).annotateMerge(
        endpointAnnotations({
          identifier: linkHttpEndpointId("unlink", object, traversal),
          summary: `Unlink ${traversal.traversal.label.toLowerCase()}`,
        })
      )
    )
  }
  return result
}

/** Maps generated request-decoding failures into the portable validation contract. */
export class HttpValidationMiddleware extends HttpApiMiddleware.Service<HttpValidationMiddleware>()(
  "@company/runtime/HttpValidationMiddleware",
  { error: validationErrorSchema }
) {
  static readonly layer = HttpApiMiddleware.layerSchemaErrorTransform(
    this,
    ({ cause }) => Effect.fail(schemaErrorToApiError(cause))
  )
}

function endpointAnnotations(options: {
  readonly description?: string
  readonly identifier: string
  readonly summary: string
}) {
  return OpenApi.annotations(options)
}

function addDefaultEndpoints(
  group: DynamicGroup,
  model: ModelCatalog,
  object: ObjectType,
  basePath: `/${string}`
): DynamicGroup {
  const collectionPath = `${basePath}/${object.collection}` as const
  const parameter = pathParameter(object)
  const recordPath = `${collectionPath}/:${parameter.name}` as const
  const record = objectRecordOutputSchema(object)
  const createInput = toEffectModelObjectCreateSchema(model, object)
  const updateInput = toEffectModelObjectUpdateSchema(model, object)
  const queries = standardQueries(object)
  const listErrors = projectedErrorSchemas(object, queries.list)
  const getErrors = projectedErrorSchemas(object, queries.get)
  const batchGetErrors = projectedErrorSchemas(object, queries.batchGet)
  let result = group

  const listInput = objectListInputSchema(object)
  const listResponse = objectPageOutputSchema(object)
  const listEndpoint = HttpApiEndpoint.get(
    httpEndpointId("list", object),
    collectionPath,
    {
      query: {
        filter: Schema.optionalKey(
          Schema.fromJsonString(
            Schema.requiredKey(listInput.fields.filter)
          ).annotate({
            description:
              "JSON-encoded structured filter. Supports nested and/or/not expressions.",
          })
        ),
        sort: Schema.optionalKey(
          Schema.fromJsonString(
            Schema.requiredKey(listInput.fields.sort)
          ).annotate({
            description:
              "JSON-encoded array of field, direction, and optional nulls ordering.",
          })
        ),
        pageSize: Schema.optionalKey(pageSizeSchema),
        pageToken: Schema.optionalKey(
          pageTokenSchema.annotate({
            description:
              "Opaque token returned by the previous page. Other request arguments must remain unchanged.",
          })
        ),
      },
      success: listResponse,
      error: listErrors,
    }
  ).annotateMerge(
    endpointAnnotations({
      identifier: httpEndpointId("list", object),
      summary: `List ${object.pluralName.toLowerCase()}`,
    })
  )
  result = result.add(listEndpoint)

  const batchResponse = objectBatchOutputSchema(object)
  const batchEndpoint = HttpApiEndpoint.post(
    httpEndpointId("batchGet", object),
    customMethodPath(collectionPath, "batchGet"),
    {
      params: { batchGet: customMethodParameter("batchGet") },
      payload: objectBatchGetInputSchema(object),
      success: batchResponse,
      error: batchGetErrors,
    }
  ).annotateMerge(
    endpointAnnotations({
      description: `Returns records in the same order as the requested identifiers. The request fails if any identifier cannot be resolved.`,
      identifier: httpEndpointId("batchGet", object),
      summary: `Batch get ${object.pluralName.toLowerCase()}`,
    })
  )
  result = result.add(batchEndpoint)

  if (object.actions.batchDelete !== undefined) {
    const endpoint = HttpApiEndpoint.post(
      httpEndpointId("batchDelete", object),
      customMethodPath(collectionPath, "batchDelete"),
      {
        params: { batchDelete: customMethodParameter("batchDelete") },
        payload: Schema.Struct({
          ids: Schema.Array(
            toEffectRecordIdentifierSchema(object.id).annotate({
              title: `${object.name} ID or alias`,
            })
          )
            .check(
              Schema.isMinLength(1),
              Schema.isMaxLength(MAX_BATCH_DELETE_SIZE)
            )
            .annotate({
              description: `One to ${MAX_BATCH_DELETE_SIZE} unique ${object.name.toLowerCase()} IDs or aliases.`,
            }),
        }).annotate({
          identifier: `${pascalCase(object.id)}BatchDeleteInput`,
          title: `Batch delete ${object.pluralName.toLowerCase()}`,
        }),
        success: HttpApiSchema.NoContent,
        error: projectedErrorSchemas(object, object.actions.batchDelete),
      }
    ).annotateMerge(
      endpointAnnotations({
        description: `Deletes every requested ${object.name.toLowerCase()} in one atomic transaction. Identifiers must resolve to unique records; if any record cannot be deleted, none are deleted.`,
        identifier: httpEndpointId("batchDelete", object),
        summary: `Batch delete ${object.pluralName.toLowerCase()}`,
      })
    )
    result = result.add(endpoint)
  }

  if (object.actions.create !== undefined) {
    const createdRecord = record
      .pipe(HttpApiSchema.status(201))
      .annotate({ identifier: `Created${pascalCase(object.id)}` })
    const endpoint = HttpApiEndpoint.post(
      httpEndpointId("create", object),
      collectionPath,
      {
        payload: createInput,
        success: createdRecord,
        error: projectedErrorSchemas(object, object.actions.create),
      }
    ).annotateMerge(
      endpointAnnotations({
        identifier: httpEndpointId("create", object),
        summary: `Create ${object.name.toLowerCase()}`,
      })
    )
    result = result.add(endpoint)
  }

  const getEndpoint = HttpApiEndpoint.get(
    httpEndpointId("get", object),
    recordPath,
    {
      params: parameter.schema,
      success: record,
      error: getErrors,
    }
  ).annotateMerge(
    endpointAnnotations({
      identifier: httpEndpointId("get", object),
      summary: `Get ${object.name.toLowerCase()}`,
    })
  )
  result = result.add(getEndpoint)

  if (object.actions.update !== undefined) {
    const endpoint = HttpApiEndpoint.patch(
      httpEndpointId("update", object),
      recordPath,
      {
        params: parameter.schema,
        payload: updateInput,
        success: record,
        error: projectedErrorSchemas(object, object.actions.update),
      }
    ).annotateMerge(
      endpointAnnotations({
        identifier: httpEndpointId("update", object),
        summary: `Update ${object.name.toLowerCase()}`,
      })
    )
    result = result.add(endpoint)
  }

  if (object.actions.delete !== undefined) {
    const endpoint = HttpApiEndpoint.delete(
      httpEndpointId("delete", object),
      recordPath,
      {
        params: parameter.schema,
        query: {
          etag: Schema.optionalKey(
            etagSchema.annotate({
              description:
                "Current entity tag. The delete fails if the record has changed.",
            })
          ),
        },
        success: HttpApiSchema.NoContent,
        error: projectedErrorSchemas(object, object.actions.delete),
      }
    ).annotateMerge(
      endpointAnnotations({
        identifier: httpEndpointId("delete", object),
        summary: `Delete ${object.name.toLowerCase()}`,
      })
    )
    result = result.add(endpoint)
  }

  return result
}

function addCustomEndpoint(
  group: DynamicGroup,
  object: ObjectType,
  action: Action | CustomQuery,
  basePath: `/${string}`
): DynamicGroup {
  const identifier = httpEndpointId(action.id, object, action.scope)
  const placeholders = action.scope === "object" ? ["id"] : []
  const pathProperties = Object.fromEntries(
    placeholders.map((name) => [name, action.input.properties[name]!])
  )
  const bodyProperties = Object.fromEntries(
    Object.entries(action.input.properties).filter(
      ([name]) => !placeholders.includes(name)
    )
  )
  const hasBody = Object.keys(bodyProperties).length > 0
  const path =
    action.scope === "object"
      ? customMethodPath(`${basePath}/${object.collection}/:id`, action.id)
      : customMethodPath(`${basePath}/${object.collection}`, action.id)
  const error = projectedErrorSchemas(object, action)
  const payload = toEffectInputSchema(schema.object(bodyProperties)).annotate({
    identifier: `${pascalCase(identifier)}Input`,
    title: `${action.name} input`,
  })
  const params = Schema.Struct({
    ...Object.fromEntries(
      Object.entries(pathProperties).map(([key, property]) => [
        key,
        toEffectInputSchema(property),
      ])
    ),
    [action.id]: customMethodParameter(action.id),
  })
  const transport = hasBody ? { params, payload } : { params }
  const options = {
    success: toEffectSchema(action.output).annotate({
      identifier: `${pascalCase(identifier)}Output`,
      title: `${action.name} output`,
    }),
  }
  const endpointOptions =
    transport === undefined
      ? { ...options, error }
      : { ...options, ...transport, error }
  const endpoint = HttpApiEndpoint.post(
    identifier,
    path,
    endpointOptions
  ).annotateMerge(
    endpointAnnotations({
      description: action.description,
      identifier,
      summary: action.name,
    })
  )

  return group.add(endpoint)
}

/** Compiles a portable model into an Effect v4 HTTP contract. */
export function createModelHttpApi(
  model: ModelCatalog,
  options: HttpApiOptions = {}
): DynamicHttpApi {
  const basePath = options.basePath ?? defaultBasePath
  const initialApi = HttpApi.make(options.id ?? "model").annotateMerge(
    OpenApi.annotations({
      description: `Generated HTTP API for ${model.name}.`,
      title: `${model.name} API`,
      version: options.version ?? "1.0.0",
      servers: [{ url: "/" }],
    })
  )
  // SAFETY: Effect's group union is phantom state; widening it lets this
  // data-driven compiler add the closed API's groups incrementally.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  let httpApi = initialApi as unknown as DynamicHttpApi

  for (const object of modelObjects(model)) {
    const initialGroup = HttpApiGroup.make(object.id).annotateMerge(
      OpenApi.annotations({
        description: object.description,
        title: object.pluralName,
      })
    )
    // SAFETY: Effect's endpoint union is phantom state; the runtime group
    // value is unchanged while declared endpoints are added below.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    let group = initialGroup as unknown as DynamicGroup
    group = addDefaultEndpoints(group, model, object, basePath)
    group = addLinkEndpoints(group, model, object, basePath)

    for (const action of [
      ...Object.values(object.actions),
      ...Object.values(object.queries),
    ]) {
      if (isStandardActionId(action.id)) continue
      group = addCustomEndpoint(group, object, action, basePath)
    }

    httpApi = httpApi.add(group)
  }

  // SAFETY: middleware changes only Effect's phantom requirements; every
  // generated server provides HttpValidationMiddleware.layer.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const validated = httpApi.middleware(
    HttpValidationMiddleware
  ) as unknown as DynamicHttpApi
  return customMethodApi(validated)
}
