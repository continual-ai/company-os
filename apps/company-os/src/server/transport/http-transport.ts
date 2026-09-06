import {
  createModelHttpHandlers,
  HttpValidationMiddleware,
  type ModelHttpOperation,
  type ModelHttpRequest,
} from "@company/runtime/effect/http"
import { CurrentInvocation } from "@company/runtime/effect/object-service"
import { Context, Data, Effect, Layer, Stream } from "effect"
import {
  HttpEffect,
  HttpServerResponse,
  type HttpServerRequest,
  HttpRouter,
  HttpServer,
} from "effect/unstable/http"
import { HttpApiBuilder } from "effect/unstable/httpapi"

import { capabilityPermission } from "@/capabilities"
import { InvalidEventCursor } from "@/events"
import { applicationHttpApi } from "@/http-api"
import { Authentication } from "@/server/auth/authentication"
import { Authorization } from "@/server/authorization/authorization-service"
import { CommittedChanges } from "@/server/database/committed-changes"
import { Database } from "@/server/database/database"
import { EventJournal } from "@/server/events/event-journal"
import { EventNotifications } from "@/server/events/event-notifications"
import { streamEvents } from "@/server/events/event-stream"
import { ModelImplementation } from "@/server/model/model-implementation"
import { searchRecords } from "@/server/model/search-records"

import {
  internalApiError,
  unauthenticatedApiError,
  withApiErrors,
} from "./api-error"

class HttpTransportFailure extends Data.TaggedError("HttpTransportFailure")<{
  readonly cause: unknown
}> {}

function requestHeaders(request: ModelHttpRequest): Headers {
  return new Headers(request.request.headers)
}

const make = Effect.gen(function* () {
  const database = yield* Database
  const authentication = yield* Authentication
  const authorization = yield* Authorization
  const notifications = yield* EventNotifications
  const events = yield* EventJournal
  const implementation = yield* ModelImplementation

  const invoke = (
    request: ModelHttpRequest,
    descriptor: Parameters<typeof withApiErrors>[1],
    operation: ModelHttpOperation
  ) =>
    authentication.invocation(requestHeaders(request)).pipe(
      Effect.flatMap((invocation) =>
        Effect.gen(function* () {
          const changes = new Set<string>()
          const run = operation.pipe(
            Effect.provideService(CurrentInvocation, invocation)
          )
          const result = yield* (
            descriptor?.definition.kind === "action"
              ? database.transaction(() => run)
              : run
          ).pipe(Effect.provideService(CommittedChanges, changes))
          if (changes.size > 0) {
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
                    [...changes].sort().join(",")
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
              .checkCapabilitiesFor(
                caller,
                request.payload.checks.map((check) => ({
                  ...check,
                  permission: capabilityPermission(check.permission),
                }))
              )
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
      handlers.handle("searchRecords", (request) =>
        authentication.invocation(requestHeaders(request)).pipe(
          Effect.mapError(() =>
            unauthenticatedApiError("Authentication credentials are invalid.")
          ),
          Effect.flatMap((invocation) =>
            searchRecords(request.payload).pipe(
              Effect.provideService(CurrentInvocation, invocation),
              Effect.provideService(Database, database),
              Effect.provideService(Authorization, authorization),
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
      Layer.mergeAll(
        objectGroupsLayer,
        capabilityGroupLayer,
        eventGroupLayer,
        recordGroupLayer
      )
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
