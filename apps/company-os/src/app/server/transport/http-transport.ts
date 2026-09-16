import { Context, Data, Effect, Layer, Stream } from "effect"
import {
  HttpEffect,
  HttpServerResponse,
  type HttpServerRequest,
  HttpRouter,
  HttpServer,
} from "effect/unstable/http"
import { HttpApiBuilder } from "effect/unstable/httpapi"

import { Model } from "#/app.model.ts"
import { applicationHttpApi } from "#/app/server/http-api.ts"
import {
  InvalidEventCursor,
  changePage,
  type EventPage,
} from "#/runtime/contract/events.ts"
import { HttpValidationMiddleware } from "#/runtime/contract/http-api.ts"
import type { OperationContract } from "#/runtime/contract/operation-contract.ts"
import {
  internalApiError,
  unauthenticatedApiError,
  withApiErrors,
} from "#/runtime/server/api-error.ts"
import { Authentication } from "#/runtime/server/auth/authentication.ts"
import { streamChanges } from "#/runtime/server/events/change-stream.ts"
import { EventJournal } from "#/runtime/server/events/event-journal.ts"
import { EventNotifications } from "#/runtime/server/events/event-notifications.ts"
import {
  createModelHttpHandlers,
  type ModelHttpRequest,
} from "#/runtime/server/http.ts"
import { CurrentInvocation } from "#/runtime/server/invocation.ts"
import { loggingContext } from "#/runtime/server/logging.ts"
import { OperationExecutor } from "#/runtime/server/operation-executor.ts"

class HttpTransportFailure extends Data.TaggedError("HttpTransportFailure")<{
  readonly cause: unknown
}> {}

function requestHeaders(request: ModelHttpRequest): Headers {
  return new Headers(request.request.headers)
}

const make = Effect.gen(function* () {
  // Register the installed contract once; each request checks database activation.
  const operations = yield* OperationExecutor
  const authentication = yield* Authentication
  const notifications = yield* EventNotifications
  const events = yield* EventJournal
  const logging = yield* loggingContext

  const active = operations.activeModel
  const filterActiveEvents = (page: EventPage) =>
    active.pipe(
      Effect.map(({ model }) => ({
        ...page,
        items: page.items.filter((event) =>
          event.subjects.every((subject) =>
            Object.hasOwn(model.objects, subject.objectType)
          )
        ),
      }))
    )

  const invoke = (
    request: ModelHttpRequest,
    descriptor: OperationContract,
    input: unknown
  ) =>
    authentication.invocation(requestHeaders(request)).pipe(
      Effect.flatMap((invocation) =>
        Effect.gen(function* () {
          const { value: result, changes } = yield* operations.run(
            invocation,
            descriptor,
            input
          )
          if (changes.length > 0) {
            // SAFETY: HttpApiBuilder supplies its current HttpServerRequest here.
            const incoming =
              // oxlint-disable-next-line typescript/no-unsafe-type-assertion
              request.request as unknown as HttpServerRequest.HttpServerRequest
            HttpEffect.appendPreResponseHandlerUnsafe(
              incoming,
              (_request, response) =>
                Effect.succeed(
                  HttpServerResponse.setHeader(
                    response,
                    "x-model-changes",
                    changes.join(",")
                  )
                )
            )
          }
          return result
        })
      ),
      (effect) => withApiErrors(effect, descriptor),
      Effect.annotateLogs({ transport: "http", requestId: crypto.randomUUID() })
    )

  const objectGroupsLayer = createModelHttpHandlers(
    applicationHttpApi,
    Model,
    invoke
  )
  const eventInvocation = (request: {
    readonly request: HttpServerRequest.HttpServerRequest
  }) => {
    HttpEffect.appendPreResponseHandlerUnsafe(
      request.request,
      (_request, response) =>
        Effect.succeed(
          HttpServerResponse.setHeaders(response, {
            "cache-control": "private, no-store",
            "x-accel-buffering": "no",
          })
        )
    )
    return authentication
      .invocation(requestHeaders(request))
      .pipe(
        Effect.mapError(() =>
          unauthenticatedApiError("Authentication credentials are invalid.")
        )
      )
  }
  const readEvents = (query: Parameters<typeof events.list>[0]) =>
    events.list(query).pipe(
      Effect.flatMap(filterActiveEvents),
      Effect.mapError((error) =>
        error instanceof InvalidEventCursor ? error : internalApiError()
      )
    )
  const eventGroupLayer = HttpApiBuilder.group(
    applicationHttpApi,
    "events",
    (handlers) =>
      handlers
        .handle("listEvents", (request) =>
          eventInvocation(request).pipe(
            Effect.flatMap((invocation) =>
              readEvents(request.query).pipe(
                Effect.provideService(CurrentInvocation, invocation)
              )
            )
          )
        )
        .handle("listChanges", (request) =>
          eventInvocation(request).pipe(
            Effect.flatMap((invocation) =>
              readEvents({ ...request.query, pageSize: 200 }).pipe(
                Effect.map(changePage),
                Effect.provideService(CurrentInvocation, invocation)
              )
            )
          )
        )
        .handle("streamChanges", (request) =>
          eventInvocation(request).pipe(
            Effect.map((invocation) =>
              streamChanges(
                (cursor) =>
                  readEvents({ cursor, pageSize: 200 }).pipe(
                    Effect.map(changePage),
                    Effect.provideService(CurrentInvocation, invocation),
                    Effect.catch((error) =>
                      error instanceof InvalidEventCursor
                        ? Effect.fail(error)
                        : Effect.die(error)
                    )
                  ),
                request.query.cursor ?? "now"
              ).pipe(Stream.provideService(EventNotifications, notifications))
            )
          )
        )
  )
  const apiLayer = HttpApiBuilder.layer(applicationHttpApi).pipe(
    Layer.provide(Layer.mergeAll(objectGroupsLayer, eventGroupLayer)),
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
    handle: Effect.fn("@company/HttpTransport.handle")(function* (
      request: Request
    ) {
      return yield* Effect.tryPromise({
        try: () => webHandler.handler(request, logging),
        catch: (cause) => new HttpTransportFailure({ cause }),
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
export class HttpTransport extends Context.Service<HttpTransport>()(
  "@company/HttpTransport",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
