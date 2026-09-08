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

import {
  type ApiReference,
  type DynamicHttpApi,
  linkDescriptor,
} from "#/contract/http-api.ts"
import { customMethodServerApi } from "#/contract/http-custom-method.ts"
import { httpEndpointId, linkHttpEndpointId } from "#/contract/http-endpoint.ts"
import { isStandardActionId } from "#/model/definition/action.ts"
import {
  type ModelCatalog,
  modelObjectLinkTraversals,
  modelObjects,
} from "#/model/definition/model.ts"
import {
  executableModelOperation,
  type ExecutableModelOperation,
} from "#/model/operations.ts"
import type { CurrentInvocation } from "#/server/invocation.ts"
import type { LinkService } from "#/server/link-service.ts"
import {
  executeModelOperation,
  modelOperation,
} from "#/server/model-implementation.ts"

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

  handlers = handlers.handle(httpEndpointId("get", object), (request) =>
    invoke(request, descriptor("get"), call("get", request.params))
  )
  handlers = handlers.handle(httpEndpointId("list", object), (request) =>
    invoke(request, descriptor("list"), call("list", request.query))
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
  const ServerApi = customMethodServerApi(dynamicApi)

  const groupLayers = modelObjects(implementation.model).map((object) =>
    HttpApiBuilder.group(ServerApi, object.id, (initialHandlers) => {
      // SAFETY: Effect decoded these handlers from the model-derived group.
      let handlers = standardHandlers(
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        initialHandlers as unknown as DynamicHandlers,
        implementation,
        object,
        invoke
      )

      for (const action of [
        ...Object.values(object.actions),
        ...Object.values(object.queries),
      ]) {
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
                  ...request.payload,
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
