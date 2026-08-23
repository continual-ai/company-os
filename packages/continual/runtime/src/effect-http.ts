import { Schema } from "effect"
import { HttpRouter } from "effect/unstable/http"
import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiScalar,
  HttpApiSchema,
  OpenApi,
} from "effect/unstable/httpapi"

import { isStandardActionId, type Action } from "./definition/action"
import type { ErrorCategory, ErrorType } from "./definition/error"
import { type ModelCatalog, modelObjects } from "./definition/model"
import type { ObjectType } from "./definition/object"
import {
  DEFAULT_PAGE_SIZE,
  filterOperators,
  IdempotencyKey,
  MAX_BATCH_DELETE_SIZE,
  MAX_BATCH_GET_SIZE,
  MAX_PAGE_SIZE,
  nullPlacements,
  PageToken,
  sortDirections,
} from "./definition/request"
import { schema } from "./definition/schema"
import {
  ConflictError,
  NotFoundError,
  PermissionDeniedError,
  UnauthenticatedError,
  ValidationError,
} from "./definition/standard-error"
import {
  toEffectErrorSchema,
  toEffectInputSchema,
  toEffectObjectCreateSchema,
  toEffectObjectSchema,
  toEffectObjectUpdateSchema,
  toEffectRecordIdentifierSchema,
  toEffectSchema,
} from "./effect-schema"

export interface HttpApiOptions {
  readonly basePath?: `/${string}`
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
type DynamicHttpApi = HttpApi.HttpApi<string, HttpApiGroup.Constraint>

const defaultBasePath = "/api/v1" as const

const errorStatus = {
  cancelled: 499,
  unknown: 500,
  invalidArgument: 422,
  deadlineExceeded: 504,
  notFound: 404,
  alreadyExists: 409,
  permissionDenied: 403,
  resourceExhausted: 429,
  failedPrecondition: 400,
  aborted: 409,
  outOfRange: 400,
  unimplemented: 501,
  internal: 500,
  unavailable: 503,
  dataLoss: 500,
  unauthenticated: 401,
} satisfies Readonly<Record<ErrorCategory, number>>

function pascalCase(value: string): string {
  return value
    .replace(/(^|[^a-zA-Z0-9]+)([a-zA-Z0-9])/g, (_match, _prefix, char) =>
      char.toUpperCase()
    )
    .replace(/[^a-zA-Z0-9]/g, "")
}

function endpointId(
  operation: string,
  object: ObjectType,
  scope?: "collection" | "object"
): string {
  const target =
    scope === "collection" ||
    operation === "list" ||
    operation === "search" ||
    operation === "batchGet" ||
    operation === "batchDelete"
      ? object.pluralName
      : object.name
  return `${operation}${pascalCase(target)}`
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

/**
 * Effect's router can escape one literal colon with `::`, but its OpenAPI
 * projection then treats the second colon as a path parameter. A constant
 * regex parameter preserves the public `:verb` route while also giving each
 * collection action a distinct internal route shape.
 */
function effectActionRoute(path: `/${string}`): `/${string}` {
  const constantVerbs = path.replace(
    /:([a-zA-Z][a-zA-Z0-9]*)(?=\/|$)/g,
    ":$1($1)"
  )
  // SAFETY: replacing placeholders and annotating constant verbs preserves the
  // leading slash required by Effect's route type.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return constantVerbs.replace(/\{([^}/]+)\}/g, ":$1") as `/${string}`
}

const mutationHeaders = {
  "idempotency-key": Schema.optionalKey(
    Schema.String.check(Schema.isMaxLength(200))
      .pipe(Schema.fromBrand("IdempotencyKey", IdempotencyKey))
      .annotate({
        description:
          "A caller-generated key used to make retries of this mutation safe.",
        title: "Idempotency key",
      })
  ),
}

const pageTokenSchema = Schema.String.pipe(
  Schema.fromBrand("PageToken", PageToken)
)

const compiledErrorSchemas = new WeakMap<ErrorType, Schema.Top>()

function errorSchemas(errors: ReadonlyArray<ErrorType>) {
  return errors.map((error) => {
    const cached = compiledErrorSchemas.get(error)
    if (cached !== undefined) return cached

    const compiled = toEffectErrorSchema(error).pipe(
      HttpApiSchema.status(errorStatus[error.category])
    )
    compiledErrorSchemas.set(error, compiled)
    return compiled
  })
}

const authorizationErrors = [UnauthenticatedError, PermissionDeniedError]
const mutationErrors = [...authorizationErrors, ValidationError, ConflictError]

function endpointAnnotations(options: {
  readonly description?: string
  readonly identifier: string
  readonly summary: string
}) {
  return OpenApi.annotations(options)
}

function addDefaultEndpoints(
  group: DynamicGroup,
  object: ObjectType,
  basePath: `/${string}`
): DynamicGroup {
  const collectionPath = `${basePath}/${object.collection}` as const
  const parameter = pathParameter(object)
  const recordPath = `${collectionPath}/:${parameter.name}` as const
  const record = toEffectObjectSchema(object)
  const createInput = toEffectObjectCreateSchema(object)
  const updateInput = toEffectObjectUpdateSchema(object)
  const readErrors = errorSchemas(authorizationErrors)
  const notFoundErrors = errorSchemas([...authorizationErrors, NotFoundError])
  const writeErrors = errorSchemas(mutationErrors)
  const recordWriteErrors = errorSchemas([...mutationErrors, NotFoundError])
  let result = group

  const listResponse = Schema.Struct({
    items: Schema.Array(record),
    nextPageToken: Schema.Union([
      Schema.Literal(""),
      pageTokenSchema.annotate({
        description:
          "Opaque continuation token; empty when there is no next page.",
      }),
    ]),
  }).annotate({
    identifier: `${pascalCase(object.id)}List`,
    title: object.pluralName,
  })
  const listEndpoint = HttpApiEndpoint.get(
    endpointId("list", object),
    collectionPath,
    {
      query: {
        pageSize: Schema.optionalKey(
          Schema.Number.check(
            Schema.isInt(),
            Schema.isGreaterThanOrEqualTo(1),
            Schema.isLessThanOrEqualTo(MAX_PAGE_SIZE)
          ).annotate({
            default: DEFAULT_PAGE_SIZE,
            description: `Maximum number of records to return. Defaults to ${DEFAULT_PAGE_SIZE}; capped at ${MAX_PAGE_SIZE}.`,
          })
        ),
        pageToken: Schema.optionalKey(
          pageTokenSchema.annotate({
            description:
              "Opaque token returned by the previous page. Other request arguments must remain unchanged.",
          })
        ),
      },
      success: listResponse,
      error: readErrors,
    }
  ).annotateMerge(
    endpointAnnotations({
      identifier: endpointId("list", object),
      summary: `List ${object.pluralName.toLowerCase()}`,
    })
  )
  result = result.add(listEndpoint)

  const filterFields = [
    "createdAt",
    "createdById",
    "id",
    "parentId",
    "updatedAt",
    "updatedById",
    ...Object.keys(object.properties),
  ]
  const fieldSchema = Schema.Literals(filterFields).annotate({
    description: `A declared ${object.name.toLowerCase()} property or standard record field.`,
    identifier: `${pascalCase(object.id)}FilterField`,
  })
  const filterOperatorSchema = Schema.Literals(filterOperators).annotate({
    identifier: `${pascalCase(object.id)}FilterOperator`,
  })
  const sortDirectionSchema = Schema.Literals(sortDirections).annotate({
    identifier: "SortDirection",
  })
  const nullPlacementSchema = Schema.Literals(nullPlacements).annotate({
    identifier: "NullPlacement",
  })
  let filterSchema: Schema.Codec<unknown, unknown>
  filterSchema = Schema.suspend(() =>
    Schema.Union([
      Schema.Struct({ and: Schema.Array(filterSchema) }).annotate({
        identifier: `${pascalCase(object.id)}AndFilter`,
      }),
      Schema.Struct({ not: filterSchema }).annotate({
        identifier: `${pascalCase(object.id)}NotFilter`,
      }),
      Schema.Struct({ or: Schema.Array(filterSchema) }).annotate({
        identifier: `${pascalCase(object.id)}OrFilter`,
      }),
      Schema.Struct({
        field: fieldSchema,
        operator: filterOperatorSchema,
        value: Schema.optionalKey(Schema.Unknown),
      }).annotate({
        identifier: `${pascalCase(object.id)}FieldFilter`,
      }),
    ]).annotate({ identifier: `${pascalCase(object.id)}FilterExpression` })
  ).annotate({
    identifier: `${pascalCase(object.id)}Filter`,
    title: `${object.name} filter`,
  })
  const searchEndpoint = HttpApiEndpoint.post(
    endpointId("search", object),
    `${collectionPath}/search`,
    {
      payload: Schema.Struct({
        filter: Schema.optionalKey(filterSchema),
        pageSize: Schema.optionalKey(
          Schema.Number.check(
            Schema.isInt(),
            Schema.isGreaterThanOrEqualTo(1),
            Schema.isLessThanOrEqualTo(MAX_PAGE_SIZE)
          )
        ),
        pageToken: Schema.optionalKey(pageTokenSchema),
        sort: Schema.optionalKey(
          Schema.Array(
            Schema.Struct({
              direction: sortDirectionSchema,
              field: fieldSchema,
              nulls: Schema.optionalKey(nullPlacementSchema),
            })
          )
        ),
      }).annotate({
        identifier: `${pascalCase(object.id)}SearchInput`,
        title: `Search ${object.pluralName.toLowerCase()}`,
      }),
      success: listResponse,
      error: readErrors,
    }
  ).annotateMerge(
    endpointAnnotations({
      description:
        "Standard object search with nested boolean filters, type-aware comparison operators, deterministic multi-property sorting, and cursor pagination.",
      identifier: endpointId("search", object),
      summary: `Search ${object.pluralName.toLowerCase()}`,
    })
  )
  result = result.add(searchEndpoint)

  const batchResponse = Schema.Struct({
    items: Schema.Array(record),
  }).annotate({
    identifier: `${pascalCase(object.id)}Batch`,
    title: `${object.pluralName} batch`,
  })
  const batchEndpoint = HttpApiEndpoint.post(
    endpointId("batchGet", object),
    effectActionRoute(`${collectionPath}:batchGet`),
    {
      payload: Schema.Struct({
        ids: Schema.Array(
          toEffectRecordIdentifierSchema(object.id).annotate({
            title: `${object.name} ID or alias`,
          })
        ).check(Schema.isMinLength(1), Schema.isMaxLength(MAX_BATCH_GET_SIZE)),
      }).annotate({
        identifier: `${pascalCase(object.id)}BatchGetInput`,
        title: `Batch get ${object.pluralName.toLowerCase()}`,
      }),
      success: batchResponse,
      error: notFoundErrors,
    }
  ).annotateMerge(
    endpointAnnotations({
      description: `Returns records in the same order as the requested identifiers. The request fails if any identifier cannot be resolved.`,
      identifier: endpointId("batchGet", object),
      summary: `Batch get ${object.pluralName.toLowerCase()}`,
    })
  )
  result = result.add(batchEndpoint)

  if (object.actions.batchDelete !== undefined) {
    const endpoint = HttpApiEndpoint.post(
      endpointId("batchDelete", object),
      effectActionRoute(`${collectionPath}:batchDelete`),
      {
        headers: mutationHeaders,
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
        error: recordWriteErrors,
      }
    ).annotateMerge(
      endpointAnnotations({
        description: `Deletes every requested ${object.name.toLowerCase()} in one atomic transaction. Identifiers must resolve to unique records; if any record cannot be deleted, none are deleted.`,
        identifier: endpointId("batchDelete", object),
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
      endpointId("create", object),
      collectionPath,
      {
        headers: mutationHeaders,
        payload: createInput,
        success: createdRecord,
        error: writeErrors,
      }
    ).annotateMerge(
      endpointAnnotations({
        identifier: endpointId("create", object),
        summary: `Create ${object.name.toLowerCase()}`,
      })
    )
    result = result.add(endpoint)
  }

  const getEndpoint = HttpApiEndpoint.get(
    endpointId("get", object),
    recordPath,
    {
      params: parameter.schema,
      success: record,
      error: notFoundErrors,
    }
  ).annotateMerge(
    endpointAnnotations({
      identifier: endpointId("get", object),
      summary: `Get ${object.name.toLowerCase()}`,
    })
  )
  result = result.add(getEndpoint)

  if (object.actions.update !== undefined) {
    const endpoint = HttpApiEndpoint.patch(
      endpointId("update", object),
      recordPath,
      {
        headers: mutationHeaders,
        params: parameter.schema,
        payload: updateInput,
        success: record,
        error: recordWriteErrors,
      }
    ).annotateMerge(
      endpointAnnotations({
        identifier: endpointId("update", object),
        summary: `Update ${object.name.toLowerCase()}`,
      })
    )
    result = result.add(endpoint)
  }

  if (object.actions.delete !== undefined) {
    const endpoint = HttpApiEndpoint.delete(
      endpointId("delete", object),
      recordPath,
      {
        headers: mutationHeaders,
        params: parameter.schema,
        success: HttpApiSchema.NoContent,
        error: recordWriteErrors,
      }
    ).annotateMerge(
      endpointAnnotations({
        identifier: endpointId("delete", object),
        summary: `Delete ${object.name.toLowerCase()}`,
      })
    )
    result = result.add(endpoint)
  }

  return result
}

function addActionEndpoint(
  group: DynamicGroup,
  object: ObjectType,
  action: Action,
  basePath: `/${string}`
): DynamicGroup {
  const identifier = endpointId(action.id, object, action.scope)
  const placeholders = [...action.http.path.matchAll(/\{([^}/]+)\}/g)].map(
    (match) => match[1] ?? ""
  )
  const pathProperties = Object.fromEntries(
    placeholders.map((name) => [name, action.input.properties[name]!])
  )
  const bodyProperties = Object.fromEntries(
    Object.entries(action.input.properties).filter(
      ([name]) => !placeholders.includes(name)
    )
  )
  const hasBody = Object.keys(bodyProperties).length > 0
  const route = effectActionRoute(action.http.path)
  // SAFETY: basePath and authored action paths both begin with a slash.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const path = `${basePath}${route}` as `/${string}`
  const error = errorSchemas([
    ...mutationErrors,
    ...(action.scope === "object" ? [NotFoundError] : []),
    ...action.errors,
  ])
  const payload = toEffectInputSchema(schema.object(bodyProperties)).annotate({
    identifier: `${pascalCase(identifier)}Input`,
    title: `${action.name} input`,
  })
  const params = toEffectInputSchema(schema.object(pathProperties))
  const transport =
    placeholders.length === 0
      ? hasBody
        ? { payload }
        : undefined
      : hasBody
        ? { params, payload }
        : { params }
  const options = {
    headers: mutationHeaders,
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

const restoreActionPaths: (typeof OpenApi.Transform)["Service"] = (
  document
) => {
  // SAFETY: Effect invokes this hook only with the OpenAPI document it just
  // generated; the narrower type exposes that library-owned contract.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const openApi = document as OpenApi.OpenAPISpec
  return {
    ...openApi,
    paths: Object.fromEntries(
      Object.entries(openApi.paths).map(([path, operation]) => [
        path
          .replace(/\{([^}/]+)\}\(\1\)/g, ":$1")
          .replace(/:\{([^}/]+)\}$/g, ":$1"),
        operation,
      ])
    ),
  }
}

/** Compiles a portable company model into the Effect v4 HTTP contract. */
export function createHttpApi(
  model: ModelCatalog,
  options: HttpApiOptions = {}
): DynamicHttpApi {
  const basePath = options.basePath ?? defaultBasePath
  const initialApi = HttpApi.make(model.id).annotateMerge(
    OpenApi.annotations({
      description: `Generated HTTP API for ${model.name}.`,
      title: `${model.name} API`,
      version: options.version ?? "1.0.0",
      servers: [{ url: "/" }],
      transform: restoreActionPaths,
    })
  )
  // SAFETY: Effect's group union is phantom state; widening it lets this
  // data-driven compiler add the closed API's groups incrementally.
  // oxlint-disable-next-line anti-slop/no-chained-type-assertions, typescript/no-unsafe-type-assertion
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
    // oxlint-disable-next-line anti-slop/no-chained-type-assertions, typescript/no-unsafe-type-assertion
    let group = initialGroup as unknown as DynamicGroup
    group = addDefaultEndpoints(group, object, basePath)

    for (const action of Object.values(object.actions)) {
      if (isStandardActionId(action.id)) continue
      group = addActionEndpoint(group, object, action, basePath)
    }

    httpApi = httpApi.add(group)
  }

  return httpApi
}

/** Builds the Fetch handler used to serve Effect's Scalar reference. */
export function createApiReference(
  httpApi: DynamicHttpApi,
  path: `/${string}` = "/api/docs",
  scalar: HttpApiScalar.ScalarConfig = {}
): ApiReference {
  const reference = HttpRouter.toWebHandler(
    HttpApiScalar.layerCdn(httpApi, {
      path,
      version: "1.43.5",
      scalar: {
        defaultOpenAllTags: true,
        hideTestRequestButton: true,
        showOperationId: true,
        showSidebar: true,
        ...scalar,
      },
    }),
    { disableLogger: true }
  )
  return {
    dispose: reference.dispose,
    handler: reference.handler,
  }
}
