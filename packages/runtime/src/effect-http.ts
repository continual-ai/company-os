// Effect's HttpApi builder is statically keyed while a Model is intentionally
// data-driven. This module contains the one dynamic bridge between them.
import { Effect, Layer, Schema } from "effect"
import { HttpRouter } from "effect/unstable/http"
import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiMiddleware,
  HttpApiScalar,
  HttpApiSchema,
  OpenApi,
} from "effect/unstable/httpapi"

import { isStandardActionId, type Action } from "./definition/action"
import type { ErrorStatus, ErrorType } from "./definition/error"
import {
  type ModelCatalog,
  type ModelLinkTraversal,
  modelObjectLinkTraversals,
  modelObjects,
} from "./definition/model"
import { Etag, type ObjectType } from "./definition/object"
import { standardQueries } from "./definition/query"
import { MAX_BATCH_DELETE_SIZE, PageToken } from "./definition/request"
import { schema } from "./definition/schema"
import { ValidationError } from "./definition/standard-error"
import { httpEndpointId, linkHttpEndpointId } from "./effect-http-client"
import type { LinkService } from "./effect-link-service"
import {
  executableModelOperation,
  executableModelOperations,
  executeModelOperation,
  type ExecutableModelOperation,
  modelOperation,
  modelOperationErrors,
} from "./effect-model-implementation"
import {
  objectBatchGetInputSchema,
  objectBatchOutputSchema,
  objectListInputSchema,
  objectPageOutputSchema,
  objectRecordOutputSchema,
  pageSizeSchema,
  pageTotalSizeSchema,
} from "./effect-model-schemas"
import type { CurrentInvocation } from "./effect-object-service"
import {
  toEffectErrorSchema,
  toEffectInputSchema,
  toEffectModelObjectCreateSchema,
  toEffectModelObjectUpdateSchema,
  toEffectRecordIdentifierSchema,
  toEffectSchema,
  schemaErrorToApiError,
} from "./effect-schema"

export interface HttpApiOptions {
  readonly basePath?: `/${string}`
  readonly id?: string
  readonly version?: string
}

export interface ApiReference {
  readonly dispose: () => Promise<void>
  readonly handler: (request: Request) => Promise<Response>
}

export interface ModelHttpRequest {
  readonly params?: Readonly<Record<string, unknown>>
  readonly payload?: Readonly<Record<string, unknown>>
  readonly query?: Readonly<Record<string, unknown>>
  readonly request: {
    readonly headers: Readonly<Record<string, string>>
  }
}

export type ModelHttpOperation = Effect.Effect<
  unknown,
  unknown,
  CurrentInvocation
>

export type ModelHttpInvoke = (
  request: ModelHttpRequest,
  descriptor: ExecutableModelOperation,
  operation: ModelHttpOperation
) => Effect.Effect<unknown, unknown>

type DynamicGroup = HttpApiGroup.HttpApiGroup<
  string,
  HttpApiEndpoint.Constraint,
  boolean
>
type DynamicHttpApi = HttpApi.HttpApi<string, HttpApiGroup.Constraint>

type DynamicHandlers = {
  readonly handle: (
    identifier: string,
    handler: (request: ModelHttpRequest) => Effect.Effect<unknown, unknown>
  ) => DynamicHandlers
}

type CompleteHandlers = HttpApiBuilder.Handlers<
  never,
  Record<string, HttpApiEndpoint.Constraint>,
  string
>

type ExecutableModelImplementation = {
  readonly links: LinkService<unknown, CurrentInvocation>
  readonly model: ModelCatalog
  readonly services: Readonly<Record<string, object>>
}

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
  definition:
    | Action
    | ReturnType<typeof standardQueries>[keyof ReturnType<
        typeof standardQueries
      >]
) {
  return errorSchemas(
    modelOperationErrors({
      definition,
      key: `${object.id}.${definition.id}`,
      object,
    })
  )
}

function linkDescriptor(
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
        },
        success: Schema.Struct({
          items: Schema.Array(
            Schema.Struct({
              id: Schema.String,
              objectType: Schema.String,
            })
          ),
          nextPageToken: Schema.NullOr(pageTokenSchema),
          totalSize: pageTotalSizeSchema,
        }).annotate({
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
    const targetPath = `${collectionPath}/:target` as const
    const params = Schema.Struct({
      id: toEffectRecordIdentifierSchema(object.id),
      target: toEffectRecordIdentifierSchema(traversal.target.from.typeId),
    })
    const linkActionDescriptor = linkDescriptor(
      model,
      object,
      traversal,
      "link"
    )
    result = result.add(
      HttpApiEndpoint.put(
        linkHttpEndpointId("link", object, traversal),
        targetPath,
        {
          params,
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

    if (
      traversal.traversal.cardinality === "one" ||
      traversal.target.cardinality === "one"
    ) {
      continue
    }
    const unlinkDescriptor = linkDescriptor(model, object, traversal, "unlink")
    result = result.add(
      HttpApiEndpoint.delete(
        linkHttpEndpointId("unlink", object, traversal),
        targetPath,
        {
          params,
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

  const listResponse = objectPageOutputSchema(object)
  const listEndpoint = HttpApiEndpoint.get(
    httpEndpointId("list", object),
    collectionPath,
    {
      query: {
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

  const searchEndpoint = HttpApiEndpoint.post(
    httpEndpointId("search", object),
    `${collectionPath}/search`,
    {
      payload: objectListInputSchema(object),
      success: listResponse,
      error: listErrors,
    }
  ).annotateMerge(
    endpointAnnotations({
      description:
        "Standard object search with nested boolean filters, type-aware comparison operators, deterministic multi-property sorting, and cursor pagination.",
      identifier: httpEndpointId("search", object),
      summary: `Search ${object.pluralName.toLowerCase()}`,
    })
  )
  result = result.add(searchEndpoint)

  const batchResponse = objectBatchOutputSchema(object)
  const batchEndpoint = HttpApiEndpoint.post(
    httpEndpointId("batchGet", object),
    `${collectionPath}/batchGet`,
    {
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
      `${collectionPath}/batchDelete`,
      {
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

function addActionEndpoint(
  group: DynamicGroup,
  object: ObjectType,
  action: Action,
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
      ? (`${basePath}/${object.collection}/:id/actions/${action.id}` as const)
      : (`${basePath}/${object.collection}/actions/${action.id}` as const)
  const error = projectedErrorSchemas(object, action)
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
      transform: restoreActionPaths,
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

    for (const action of Object.values(object.actions)) {
      if (isStandardActionId(action.id)) continue
      group = addActionEndpoint(group, object, action, basePath)
    }

    httpApi = httpApi.add(group)
  }

  // SAFETY: middleware changes only Effect's phantom requirements; every
  // generated server provides HttpValidationMiddleware.layer.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return httpApi.middleware(
    HttpValidationMiddleware
  ) as unknown as DynamicHttpApi
}

function standardHandlers(
  initial: DynamicHandlers,
  implementation: ExecutableModelImplementation,
  object: ReturnType<typeof modelObjects>[number],
  invoke: ModelHttpInvoke
): DynamicHandlers {
  let handlers = initial
  const call = (id: string, input: unknown) =>
    modelOperation(implementation, object.id, id)(input)
  const descriptor = (id: string) =>
    executableModelOperation(implementation.model, object.id, id)

  handlers = handlers.handle(httpEndpointId("list", object), (request) =>
    invoke(request, descriptor("list"), call("list", request.query))
  )
  handlers = handlers.handle(httpEndpointId("search", object), (request) =>
    invoke(request, descriptor("list"), call("list", request.payload))
  )
  handlers = handlers.handle(httpEndpointId("batchGet", object), (request) =>
    invoke(request, descriptor("batchGet"), call("batchGet", request.payload))
  )

  for (const action of Object.values(object.actions)) {
    if (!isStandardActionId(action.id)) continue
    handlers = handlers.handle(httpEndpointId(action.id, object), (request) =>
      invoke(
        request,
        descriptor(action.id),
        call(action.id, {
          ...request.params,
          ...request.query,
          ...request.payload,
        })
      )
    )
  }
  return handlers
}

/** Binds every model-derived HTTP endpoint to the corresponding service method. */
export function createModelHttpHandlers(
  api: unknown,
  implementation: ExecutableModelImplementation,
  invoke: ModelHttpInvoke
) {
  // SAFETY: callers provide an Effect HttpApi containing groups generated from
  // implementation.model; the dynamic compiler validates those same keys.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const dynamicApi = api as DynamicHttpApi
  const groupLayers = modelObjects(implementation.model).map((object) =>
    HttpApiBuilder.group(dynamicApi, object.id, (initialHandlers) => {
      // SAFETY: Effect decoded these handlers from the model-derived group.
      let handlers = standardHandlers(
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        initialHandlers as unknown as DynamicHandlers,
        implementation,
        object,
        invoke
      )

      for (const action of Object.values(object.actions)) {
        if (isStandardActionId(action.id)) continue
        handlers = handlers.handle(
          httpEndpointId(action.id, object, action.scope),
          (request) =>
            invoke(
              request,
              executableModelOperation(
                implementation.model,
                object.id,
                action.id
              ),
              modelOperation(
                implementation,
                object.id,
                action.id
              )({
                ...request.params,
                ...request.payload,
              })
            )
        )
      }

      for (const traversal of modelObjectLinkTraversals(
        implementation.model,
        object
      )) {
        const register = (operation: "link" | "list" | "unlink") => {
          const descriptor = linkDescriptor(
            implementation.model,
            object,
            traversal,
            operation
          )
          handlers = handlers.handle(
            linkHttpEndpointId(operation, object, traversal),
            (request) =>
              invoke(
                request,
                descriptor,
                executeModelOperation(implementation, descriptor, {
                  ...request.params,
                  ...request.query,
                })
              )
          )
        }
        register("list")
        if (!traversal.writable) continue
        register("link")
        if (
          traversal.traversal.cardinality !== "one" &&
          traversal.target.cardinality !== "one"
        ) {
          register("unlink")
        }
      }

      // SAFETY: every endpoint generated for the group was registered above.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      return handlers as unknown as CompleteHandlers
    })
  )

  const first = groupLayers[0]
  if (first === undefined) {
    throw new Error("A model must contain at least one object.")
  }
  return groupLayers
    .slice(1)
    .reduce((layers, group) => Layer.merge(layers, group), first)
}

/** Builds the Fetch handler used to serve Effect's Scalar reference. */
export function createApiReference<
  TId extends string,
  TGroups extends HttpApiGroup.Constraint,
>(
  httpApi: HttpApi.HttpApi<TId, TGroups>,
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
