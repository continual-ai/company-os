import { Context, Data, Effect, Layer, Option, Schema } from "effect"

import { appMetadata } from "#/app/app-metadata.ts"
import { appUrl } from "#/app/client-environment.ts"
import { RecordId } from "#/runtime/model/index.ts"
import {
  internalApiError,
  unauthenticatedApiError,
} from "#/runtime/server/api-error.ts"
import { Authentication } from "#/runtime/server/auth/authentication.ts"
import { Operations } from "#/runtime/server/invoke.ts"
import {
  createModelMcpHandler,
  validateModelMcpRequest,
} from "#/runtime/server/mcp.ts"
import { ModelImplementation } from "#/runtime/server/model/implementation.ts"

class McpTransportFailure extends Data.TaggedError("McpTransportFailure")<{
  readonly cause: unknown
}> {}

const localMcpHostnames = ["localhost", "127.0.0.1", "[::1]"] as const

function allowedMcpHostnames(): ReadonlyArray<string> {
  const configuredOrigin = appUrl()
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
  const operations = yield* Operations
  const runPromise = Effect.runPromiseWith(yield* Effect.context())
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
          name: appMetadata.name,
          version: appMetadata.version,
          run: (descriptor, operation) =>
            runPromise(
              operations.run(invocation, descriptor, operation).pipe(
                Effect.match({
                  onFailure: (error) => ({ error, success: false as const }),
                  onSuccess: ({ value }) => ({ success: true as const, value }),
                })
              )
            ),
        }
      })
    ),
    (server) => Effect.promise(() => server.close())
  )

  return {
    handle: Effect.fn("@company/McpTransport.handle")(function* (
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
        catch: (cause) => new McpTransportFailure({ cause }),
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
export class McpTransport extends Context.Service<McpTransport>()(
  "@company/McpTransport",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
