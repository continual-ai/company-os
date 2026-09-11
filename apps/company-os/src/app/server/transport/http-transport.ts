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
  type EventPage,
} from "#/runtime/contract/events.ts"
import { HttpValidationMiddleware } from "#/runtime/contract/http-api.ts"
import type { ExecutableModelOperation } from "#/runtime/model/operations.ts"
import {
  activeModuleModel,
  requireModuleOperation,
} from "#/runtime/platform/server/index.ts"
import {
  internalApiError,
  unauthenticatedApiError,
  withApiErrors,
} from "#/runtime/server/api-error.ts"
import { Authentication } from "#/runtime/server/auth/authentication.ts"
import { EventJournal } from "#/runtime/server/events/event-journal.ts"
import { EventNotifications } from "#/runtime/server/events/event-notifications.ts"
import { streamEvents } from "#/runtime/server/events/event-stream.ts"
import {
  createModelHttpHandlers,
  type ModelHttpOperation,
  type ModelHttpRequest,
} from "#/runtime/server/http.ts"
import { CurrentInvocation } from "#/runtime/server/invocation.ts"
import { Operations } from "#/runtime/server/invoke.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"
import { ModelImplementation } from "#/runtime/server/model/implementation.ts"
import { ObjectRepositories } from "#/runtime/server/model/object-repositories.ts"
import { createRecordBatchGet } from "#/runtime/server/record-batch.ts"
import { createRecordSearch } from "#/runtime/server/record-search.ts"
import { Database } from "#/runtime/server/storage/database.ts"

class HttpTransportFailure extends Data.TaggedError("HttpTransportFailure")<{
  readonly cause: unknown
}> {}

function requestHeaders(request: ModelHttpRequest): Headers {
  return new Headers(request.request.headers)
}

const make = Effect.gen(function* () {
  const modelContext = yield* ModelContext
  // Register the installed contract once; each request checks database activation.
  const operations = yield* Operations
  const database = yield* Database
  const repositories = yield* ObjectRepositories
  const authentication = yield* Authentication
  const notifications = yield* EventNotifications
  const events = yield* EventJournal
  const implementation = yield* ModelImplementation

  const active = activeModuleModel().pipe(
    Effect.provideService(Database, database),
    Effect.provideService(ModelContext, modelContext)
  )
  const filterActiveEvents = (page: EventPage) =>
    active.pipe(
      Effect.map(({ model }) => ({
        ...page,
        items: page.items.filter((event) =>
          event.subjects.every(
            (subject) =>
              Object.hasOwn(model.objects, subject.objectType) ||
              subject.objectType === model.root.id
          )
        ),
      }))
    )

  const invoke = (
    request: ModelHttpRequest,
    descriptor: ExecutableModelOperation,
    operation: ModelHttpOperation
  ) =>
    authentication.invocation(requestHeaders(request)).pipe(
      Effect.flatMap((invocation) =>
        Effect.gen(function* () {
          yield* requireModuleOperation(descriptor).pipe(
            Effect.provideService(Database, database),
            Effect.provideService(ModelContext, modelContext)
          )
          const { value: result, changes } = yield* operations.run(
            invocation,
            descriptor,
            operation
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
      (effect) => withApiErrors(effect, descriptor)
    )

  const objectGroupsLayer = createModelHttpHandlers(
    applicationHttpApi,
    implementation,
    invoke,
    Model
  )
  const eventGroupLayer = HttpApiBuilder.group(
    applicationHttpApi,
    "events",
    (handlers) =>
      handlers
        .handle("streamEvents", (request) => {
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
          return authentication.invocation(requestHeaders(request)).pipe(
            Effect.mapError(() =>
              unauthenticatedApiError("Authentication credentials are invalid.")
            ),
            Effect.map((invocation) =>
              streamEvents(
                (cursor) =>
                  events.list({ cursor, pageSize: 200 }).pipe(
                    Effect.flatMap(filterActiveEvents),
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
        })
        .handle("listEvents", (request) => {
          HttpEffect.appendPreResponseHandlerUnsafe(
            request.request,
            (_request, response) =>
              Effect.succeed(
                HttpServerResponse.setHeader(
                  response,
                  "cache-control",
                  "private, no-store"
                )
              )
          )
          return authentication.invocation(requestHeaders(request)).pipe(
            Effect.mapError(() =>
              unauthenticatedApiError("Authentication credentials are invalid.")
            ),
            Effect.flatMap((invocation) =>
              events.list(request.query).pipe(
                Effect.flatMap(filterActiveEvents),
                Effect.provideService(CurrentInvocation, invocation),
                Effect.mapError((error) =>
                  error instanceof InvalidEventCursor
                    ? error
                    : internalApiError()
                )
              )
            )
          )
        })
  )
  const recordGroupLayer = HttpApiBuilder.group(
    applicationHttpApi,
    "records",
    (handlers) =>
      handlers
        .handle("batchGetRecords", (request) =>
          authentication.invocation(requestHeaders(request)).pipe(
            Effect.mapError(() =>
              unauthenticatedApiError("Authentication credentials are invalid.")
            ),
            Effect.flatMap((invocation) =>
              active.pipe(
                Effect.flatMap(({ model }) =>
                  createRecordBatchGet(model)(request.payload)
                ),
                Effect.provideService(CurrentInvocation, invocation),
                Effect.provideService(Database, database),
                Effect.provideService(ModelContext, modelContext),
                Effect.provideService(ObjectRepositories, repositories),
                Effect.catch((error) =>
                  Effect.logError("Record batch failed", error).pipe(
                    Effect.andThen(Effect.fail(internalApiError()))
                  )
                )
              )
            )
          )
        )
        .handle("searchRecords", (request) =>
          authentication.invocation(requestHeaders(request)).pipe(
            Effect.mapError(() =>
              unauthenticatedApiError("Authentication credentials are invalid.")
            ),
            Effect.flatMap((invocation) =>
              active.pipe(
                Effect.flatMap(({ model }) =>
                  createRecordSearch(model)(request.payload)
                ),
                Effect.provideService(CurrentInvocation, invocation),
                Effect.provideService(Database, database),
                Effect.provideService(ModelContext, modelContext),
                Effect.catch((error) =>
                  Effect.logError("Record search failed", error).pipe(
                    Effect.andThen(Effect.fail(internalApiError()))
                  )
                )
              )
            )
          )
        )
  )
  const apiLayer = HttpApiBuilder.layer(applicationHttpApi).pipe(
    Layer.provide(
      Layer.mergeAll(objectGroupsLayer, eventGroupLayer, recordGroupLayer)
    ),
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
        try: () => webHandler.handler(request),
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
