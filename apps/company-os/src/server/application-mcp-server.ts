import { RecordId } from "@company/runtime"
import {
  createModelMcpHandler,
  validateModelMcpRequest,
} from "@company/runtime/effect/mcp"
import { CurrentInvocation } from "@company/runtime/effect/object-service"
import { Context, Data, Effect, Layer, Option, Schema } from "effect"

import { applicationMetadata } from "@/application-metadata"

import {
  internalApiError,
  unauthenticatedApiError,
  withApiErrors,
} from "./api-error"
import { Authentication } from "./auth/authentication"
import { ModelImplementation } from "./model-implementation"

class McpServerFailure extends Data.TaggedError("McpServerFailure")<{
  readonly cause: unknown
}> {}

const localMcpHostnames = ["localhost", "127.0.0.1", "[::1]"] as const

function allowedMcpHostnames(): ReadonlyArray<string> {
  const configuredOrigin = import.meta.env.VITE_COMPANY_OS_URL?.trim()
  if (!configuredOrigin) return localMcpHostnames
  return [
    ...new Set([...localMcpHostnames, new URL(configuredOrigin).hostname]),
  ]
}

const actorIdSchema = Schema.String.pipe(
  Schema.fromBrand("ActorId", RecordId("actor"))
)
const invocationContextSchema = Schema.Struct({
  actorId: actorIdSchema,
  authorizationActorId: actorIdSchema,
})

const make = Effect.gen(function* () {
  const authentication = yield* Authentication
  const implementation = yield* ModelImplementation
  const requestPolicy = { allowedHostnames: allowedMcpHostnames() }
  const handler = yield* Effect.acquireRelease(
    Effect.sync(() =>
      createModelMcpHandler((context) => {
        // SAFETY: authInfo is constructed below after application authentication;
        // the HTTP client cannot inject this handler-only value.
        const invocation = Option.getOrUndefined(
          Schema.decodeUnknownOption(invocationContextSchema)(
            context.authInfo?.extra?.["invocation"]
          )
        )
        if (invocation === undefined) {
          throw new Error("MCP invocation context is missing.")
        }
        return {
          implementation,
          name: applicationMetadata.name,
          version: applicationMetadata.version,
          run: (descriptor, operation) =>
            Effect.runPromise(
              operation.pipe(
                Effect.provideService(CurrentInvocation, invocation),
                (effect) => withApiErrors(effect, descriptor),
                Effect.match({
                  onFailure: (error) => ({ error, success: false as const }),
                  onSuccess: (value) => ({ success: true as const, value }),
                })
              )
            ),
        }
      })
    ),
    (server) => Effect.promise(() => server.close())
  )

  return {
    handle: Effect.fn("@company/ApplicationMcpServer.handle")(function* (
      request: Request
    ) {
      const rejected = validateModelMcpRequest(request, requestPolicy)
      if (rejected !== undefined) return rejected

      const invocation = yield* authentication
        .invocation(request.headers)
        .pipe(
          Effect.catch(() =>
            Effect.succeed(
              Response.json(
                unauthenticatedApiError(
                  "Authentication credentials are invalid."
                ),
                { status: 401 }
              )
            )
          )
        )
      if (invocation instanceof Response) return invocation

      return yield* Effect.tryPromise({
        try: () =>
          handler.fetch(request, {
            authInfo: {
              clientId: invocation.authorizationActorId,
              extra: { invocation },
              scopes: [],
              token: "validated-by-application",
            },
          }),
        catch: (cause) => new McpServerFailure({ cause }),
      }).pipe(
        Effect.catch(({ cause }) =>
          Effect.logError("MCP handler failed", cause).pipe(
            Effect.as(Response.json(internalApiError(), { status: 500 }))
          )
        )
      )
    }),
  }
})

/** Fetch-compatible MCP projection of the governed application model. */
export class ApplicationMcpServer extends Context.Service<ApplicationMcpServer>()(
  "@company/ApplicationMcpServer",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
