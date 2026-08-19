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

import type { DefinedAction } from "./definition/action"
import type { DefinedApi } from "./definition/api"
import type { DefinedError, ErrorCategory } from "./definition/error"
import type { DefinedObject, ObjectOperation } from "./definition/object"
import {
  DEFAULT_PAGE_SIZE,
  MAX_BATCH_GET_SIZE,
  MAX_PAGE_SIZE,
} from "./definition/operation"
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

function endpointId(operation: ObjectOperation, object: DefinedObject): string {
  const target =
    operation === "list" || operation === "batchGet"
      ? object.pluralName
      : object.name
  return `${operation}${pascalCase(target)}`
}

function pathParameter(object: DefinedObject) {
  const name = `${object.id}Id`
  return {
    name,
    schema: Schema.Struct({
      [name]: Schema.String.check(Schema.isNonEmpty()).annotate({
        title: `${object.name} ID`,
      }),
    }),
  }
}

const mutationHeaders = {
  "idempotency-key": Schema.optionalKey(
    Schema.String.check(Schema.isNonEmpty(), Schema.isMaxLength(200)).annotate({
      description:
        "A caller-generated key used to make retries of this mutation safe.",
      title: "Idempotency key",
    })
  ),
}

const compiledErrorSchemas = new WeakMap<DefinedError, Schema.Top>()

function errorSchemas(errors: ReadonlyArray<DefinedError>) {
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

function addStandardEndpoints(
  group: DynamicGroup,
  object: DefinedObject,
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

  if (object.operations.list) {
    const listResponse = Schema.Struct({
      items: Schema.Array(record),
      nextPageToken: Schema.String.annotate({
        description:
          "Opaque continuation token; empty when there is no next page.",
      }),
    }).annotate({
      identifier: `${pascalCase(object.id)}List`,
      title: object.pluralName,
    })
    const endpoint = HttpApiEndpoint.get(
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
            Schema.String.annotate({
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
    result = result.add(endpoint)
  }

  if (object.operations.batchGet) {
    const batchResponse = Schema.Struct({
      items: Schema.Array(record),
    }).annotate({
      identifier: `${pascalCase(object.id)}Batch`,
      title: `${object.pluralName} batch`,
    })
    const endpoint = HttpApiEndpoint.post(
      endpointId("batchGet", object),
      `${collectionPath}::batchGet`,
      {
        payload: Schema.Struct({
          ids: Schema.Array(
            Schema.String.check(Schema.isNonEmpty()).annotate({
              title: `${object.name} ID`,
            })
          ).check(
            Schema.isMinLength(1),
            Schema.isMaxLength(MAX_BATCH_GET_SIZE)
          ),
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
    result = result.add(endpoint)
  }

  if (object.operations.create) {
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

  if (object.operations.get) {
    const endpoint = HttpApiEndpoint.get(
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
    result = result.add(endpoint)
  }

  if (object.operations.update) {
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

  if (object.operations.delete) {
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
  object: DefinedObject,
  action: DefinedAction,
  basePath: `/${string}`
): DynamicGroup {
  const parameter = pathParameter(object)
  // Effect's router uses `::` to escape a literal colon. The API-level
  // OpenAPI transform below restores the AIP spelling in the document.
  const path =
    `${basePath}/${object.collection}/:${parameter.name}::${action.verb}` as const
  const error = errorSchemas([
    ...mutationErrors,
    NotFoundError,
    ...action.errors,
  ])
  const options = {
    headers: mutationHeaders,
    params: parameter.schema,
    payload: toEffectSchema(action.input).annotate({
      identifier: `${pascalCase(action.id)}Input`,
      title: `${action.name} input`,
    }),
    success: toEffectSchema(action.output).annotate({
      identifier: `${pascalCase(action.id)}Output`,
      title: `${action.name} output`,
    }),
  }
  const endpoint = HttpApiEndpoint.post(action.id, path, {
    ...options,
    error,
  }).annotateMerge(
    endpointAnnotations(
      action.description === undefined
        ? { identifier: action.id, summary: action.name }
        : {
            description: action.description,
            identifier: action.id,
            summary: action.name,
          }
    )
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

/** Compiles a portable semantic API into the Effect v4 HTTP contract. */
export function createHttpApi(
  definition: DefinedApi,
  options: HttpApiOptions = {}
): DynamicHttpApi {
  const basePath = options.basePath ?? defaultBasePath
  const actions = definition.modules.flatMap((module) => module.actions)
  const initialApi = HttpApi.make(definition.id).annotateMerge(
    OpenApi.annotations({
      description: `Generated HTTP API for ${definition.name}.`,
      title: `${definition.name} API`,
      version: options.version ?? "1.0.0",
      servers: [{ url: "/" }],
      transform: restoreActionPaths,
    })
  )
  // SAFETY: Effect's group union is phantom state; widening it lets this
  // data-driven compiler add the closed API's groups incrementally.
  // oxlint-disable-next-line anti-slop/no-chained-type-assertions, typescript/no-unsafe-type-assertion
  let httpApi = initialApi as unknown as DynamicHttpApi

  for (const module of definition.modules) {
    for (const object of module.objects) {
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
      group = addStandardEndpoints(group, object, basePath)

      for (const action of actions.filter(
        (candidate) => candidate.subjectId === object.id
      )) {
        group = addActionEndpoint(group, object, action, basePath)
      }

      httpApi = httpApi.add(group)
    }
  }

  return httpApi
}

/** Builds the Fetch handler used to serve Effect's Scalar reference. */
export function createApiReference(
  httpApi: DynamicHttpApi,
  path: `/${string}` = "/api/docs"
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
      },
    }),
    { disableLogger: true }
  )
  return {
    dispose: reference.dispose,
    handler: reference.handler,
  }
}
