import { Effect, Schema } from "effect"
import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiMiddleware,
  HttpApiSchema,
  OpenApi,
} from "effect/unstable/httpapi"

import { customMethodApi } from "#/runtime/contract/http-custom-method.ts"
import { httpOperationGroups } from "#/runtime/contract/http-operation.ts"
import {
  schemaErrorToApiError,
  toEffectErrorSchema,
} from "#/runtime/contract/schema.ts"
import type {
  ErrorStatus,
  ErrorType,
} from "#/runtime/model/definition/error.ts"
import { type ModelCatalog } from "#/runtime/model/definition/model.ts"
import { ValidationError } from "#/runtime/model/definition/standard-error.ts"

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

/** Projects resolved operation contracts into HTTP; it never derives business schemas. */
export function createModelHttpApi(
  model: ModelCatalog,
  options: HttpApiOptions = {}
): DynamicHttpApi {
  const initialApi = HttpApi.make(options.id ?? "model").annotateMerge(
    OpenApi.annotations({
      description: `Generated HTTP API for ${model.name}.`,
      title: `${model.name} API`,
      version: options.version ?? "1.0.0",
      servers: [{ url: "/" }],
    })
  )
  // SAFETY: Effect's group union is phantom state; this compiler adds the closed model's groups.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  let api = initialApi as unknown as DynamicHttpApi
  for (const projected of httpOperationGroups(model, options.basePath)) {
    // SAFETY: widening only the phantom endpoint union permits model-driven assembly.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    let group = HttpApiGroup.make(projected.id).annotateMerge(
      OpenApi.annotations({
        description: projected.description,
        title: projected.title,
      })
    ) as unknown as DynamicGroup
    for (const http of projected.operations) {
      const operation = http.operation
      // A status annotation on the named record itself would duplicate its OpenAPI component.
      const success =
        http.status === 204
          ? HttpApiSchema.NoContent
          : http.status === 201
            ? Schema.suspend(() => operation.output).pipe(
                HttpApiSchema.status(201)
              )
            : operation.output
      const endpoint = HttpApiEndpoint.make(http.method)(
        http.identifier,
        http.path,
        {
          params: http.params,
          ...(Object.keys(http.input.fields).length === 0
            ? {}
            : { [http.inputLocation]: http.input }),
          success,
          error: errorSchemas(
            operation.errors.filter(
              (error) => error.reason !== ValidationError.reason
            )
          ),
        }
      ).annotateMerge(
        OpenApi.annotations({
          identifier: http.identifier,
          summary: operation.name,
          description: operation.description,
        })
      )
      group = group.add(endpoint)
    }
    api = api.add(group)
  }
  return customMethodApi(
    // SAFETY: middleware changes only Effect's phantom requirements; every server supplies the layer.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    api.middleware(HttpValidationMiddleware) as unknown as DynamicHttpApi
  )
}
