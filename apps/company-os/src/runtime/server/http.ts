// Effect's HttpApi builder is statically keyed while a Model is intentionally
// data-driven. This module contains the one dynamic bridge between them.
import { type Effect, Layer } from "effect"
import { HttpRouter } from "effect/unstable/http"
import {
  type HttpApi,
  HttpApiBuilder,
  type HttpApiEndpoint,
  type HttpApiGroup,
  HttpApiScalar,
} from "effect/unstable/httpapi"

import type {
  ApiReference,
  DynamicHttpApi,
} from "#/runtime/contract/http-api.ts"
import { customMethodServerApi } from "#/runtime/contract/http-custom-method.ts"
import {
  httpOperationGroups,
  httpOperationInput,
} from "#/runtime/contract/http-operation.ts"
import { type ModelOperation } from "#/runtime/contract/operations.ts"
import { type ModelCatalog } from "#/runtime/model/definition/model.ts"
import type { CurrentInvocation } from "#/runtime/server/invocation.ts"
import { executeModelOperation } from "#/runtime/server/model-implementation.ts"
import type { Links } from "#/runtime/server/model/link-service.ts"

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
  descriptor: ModelOperation,
  operation: ModelHttpOperation
) => Effect.Effect<unknown, unknown>

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
  readonly links: Pick<typeof Links.Service, "link" | "list" | "unlink">
  readonly model: ModelCatalog
  readonly services: Readonly<Record<string, object>>
}

/** Binds every model-derived HTTP endpoint to the corresponding service method. */
export function createModelHttpHandlers(
  api: unknown,
  implementation: ExecutableModelImplementation,
  invoke: ModelHttpInvoke,
  exposed: ModelCatalog = implementation.model
) {
  // SAFETY: callers provide an Effect HttpApi containing groups generated from
  // implementation.model; the dynamic compiler validates those same keys.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const dynamicApi = api as DynamicHttpApi
  const ServerApi = customMethodServerApi(dynamicApi)

  const groupLayers = httpOperationGroups(exposed).map((group) =>
    HttpApiBuilder.group(ServerApi, group.id, (initialHandlers) => {
      // SAFETY: every endpoint comes from this same closed operation catalog.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      let handlers = initialHandlers as unknown as DynamicHandlers
      for (const http of group.operations) {
        const operation = http.operation
        handlers = handlers.handle(http.identifier, (request) =>
          invoke(
            request,
            operation,
            executeModelOperation(
              implementation,
              operation,
              httpOperationInput(http, request)
            )
          )
        )
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
