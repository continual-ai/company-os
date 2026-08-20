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

import type { Action } from "./definition/action"
import type { ErrorCategory, ErrorType } from "./definition/error"
import { type ModelCatalog, modelObjects } from "./definition/model"
import type { ObjectType } from "./definition/object"
import {
  DEFAULT_PAGE_SIZE,
  IdempotencyKey,
  MAX_BATCH_GET_SIZE,
  MAX_PAGE_SIZE,
  PageToken,
} from "./definition/request"
import { RecordId, schema } from "./definition/schema"
import {
  ConflictError,
  NotFoundError,
  PermissionDeniedError,
  UnauthenticatedError,
  ValidationError,
} from "./definition/standard-error"
import {
  toEffectErrorSchema,
  toEffectObjectCreateSchema,
  toEffectObjectSchema,
  toEffectObjectUpdateSchema,
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

function endpointId(operation: string, object: ObjectType): string {
  const target =
    operation === "list" || operation === "batchGet"
      ? object.pluralName
      : object.name
  return `${operation}${pascalCase(target)}`
}

function pathParameter(object: ObjectType) {
  const name = "id"
  return {
    name,
    schema: Schema.Struct({
      [name]: Schema.String.pipe(
        Schema.fromBrand(`RecordId:${object.id}`, RecordId(object.id))
      ).annotate({
        title: `${object.name} ID`,
      }),
    }),
  }
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

  const batchResponse = Schema.Struct({
    items: Schema.Array(record),
  }).annotate({
    identifier: `${pascalCase(object.id)}Batch`,
    title: `${object.pluralName} batch`,
  })
  const batchEndpoint = HttpApiEndpoint.post(
    endpointId("batchGet", object),
    `${collectionPath}::batchGet`,
    {
      payload: Schema.Struct({
        ids: Schema.Array(
          Schema.String.pipe(
            Schema.fromBrand(`RecordId:${object.id}`, RecordId(object.id))
          ).annotate({
            title: `${object.name} ID`,
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
      description: `Returns records in the same order as the requested IDs. The request fails if any ID cannot be resolved.`,
      identifier: endpointId("batchGet", object),
      summary: `Batch get ${object.pluralName.toLowerCase()}`,
    })
  )
  result = result.add(batchEndpoint)

  if (object.defaultActions.create) {
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

  if (object.defaultActions.update) {
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

  if (object.defaultActions.delete) {
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
  const identifier = endpointId(action.id, object)
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
  // Effect uses :name for parameters and :: for a literal colon.
  const route = action.http.path
    .replaceAll(":", "::")
    .replace(/\{([^}/]+)\}/g, ":$1")
  // SAFETY: basePath and authored action paths both begin with a slash.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const path = `${basePath}${route}` as `/${string}`
  const error = errorSchemas([
    ...mutationErrors,
    ...(action.scope === "object" ? [NotFoundError] : []),
    ...action.errors,
  ])
  const payload = toEffectSchema(schema.object(bodyProperties)).annotate({
    identifier: `${pascalCase(identifier)}Input`,
    title: `${action.name} input`,
  })
  const params = toEffectSchema(schema.object(pathProperties))
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
        path.replace(/:\{([^}/]+)\}$/g, ":$1"),
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
