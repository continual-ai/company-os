import {
  createModelHttpHandlers,
  HttpValidationMiddleware,
  type ModelHttpOperation,
  type ModelHttpRequest,
} from "@company/runtime/effect/http"
import { CurrentInvocation } from "@company/runtime/effect/object-service"
import { Context, Data, Effect, Layer } from "effect"
import { HttpRouter, HttpServer } from "effect/unstable/http"
import { HttpApiBuilder } from "effect/unstable/httpapi"

import { applicationHttpApi } from "@/http-api"

import {
  internalApiError,
  unauthenticatedApiError,
  withApiErrors,
} from "./api-error"
import { Authentication } from "./auth/authentication"
import { Authorization } from "./authorization/authorization-service"
import { ModelImplementation } from "./model-implementation"

class HttpServerFailure extends Data.TaggedError("HttpServerFailure")<{
  readonly cause: unknown
}> {}

function requestHeaders(request: ModelHttpRequest): Headers {
  return new Headers(request.request.headers)
}

const make = Effect.gen(function* () {
  const authentication = yield* Authentication
  const authorization = yield* Authorization
  const implementation = yield* ModelImplementation

  const invoke = (
    request: ModelHttpRequest,
    descriptor: Parameters<typeof withApiErrors>[1],
    operation: ModelHttpOperation
  ) =>
    authentication.invocation(requestHeaders(request)).pipe(
      Effect.flatMap((invocation) =>
        operation.pipe(Effect.provideService(CurrentInvocation, invocation))
      ),
      (effect) => withApiErrors(effect, descriptor)
    )

  const objectGroupsLayer = createModelHttpHandlers(
    applicationHttpApi,
    implementation,
    invoke
  )
  const capabilityGroupLayer = HttpApiBuilder.group(
    applicationHttpApi,
    "capabilities",
    (handlers) =>
      handlers.handle("checkCapabilities", (request) =>
        authentication.identify(requestHeaders(request)).pipe(
          Effect.mapError(() =>
            unauthenticatedApiError("Authentication credentials are invalid.")
          ),
          Effect.flatMap((caller) =>
            authorization
              .checkCapabilitiesFor(caller, request.payload.checks)
              .pipe(
                Effect.catch((error) =>
                  Effect.logError("Capability evaluation failed", error).pipe(
                    Effect.andThen(Effect.fail(internalApiError()))
                  )
                )
              )
          )
        )
      )
  )
  const apiLayer = HttpApiBuilder.layer(applicationHttpApi).pipe(
    Layer.provide(Layer.merge(objectGroupsLayer, capabilityGroupLayer)),
    Layer.provide(HttpValidationMiddleware.layer),
    Layer.provide(HttpServer.layerServices)
  )
  const webHandler = yield* Effect.acquireRelease(
    Effect.sync(() =>
      HttpRouter.toWebHandler(apiLayer, { disableLogger: true })
    ),
    ({ dispose }) => Effect.promise(dispose)
  )

  return {
    handle: Effect.fn("@company/ApplicationHttpServer.handle")(function* (
      request: Request
    ) {
      return yield* Effect.tryPromise({
        try: () => webHandler.handler(request),
        catch: (cause) => new HttpServerFailure({ cause }),
      }).pipe(
        Effect.catch(({ cause }) =>
          Effect.logError("HTTP handler failed", cause).pipe(
            Effect.as(Response.json(internalApiError(), { status: 500 }))
          )
        )
      )
    }),
  }
})

/** Fetch-compatible HTTP projection of the governed application model. */
export class ApplicationHttpServer extends Context.Service<ApplicationHttpServer>()(
  "@company/ApplicationHttpServer",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
