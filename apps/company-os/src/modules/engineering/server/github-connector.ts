import { throttling } from "@octokit/plugin-throttling"
import { Octokit } from "@octokit/rest"
import { Clock, Context, Effect, Layer, Redacted } from "effect"

import { GitHub } from "#/modules/engineering/model/github-connector.ts"
import type { RecordId } from "#/runtime/model/index.ts"
import {
  ConnectionError,
  defineConnectorServer,
  type ReconcileResult,
} from "#/runtime/server/index.ts"

const ThrottledOctokit = Octokit.plugin(throttling)

/** Client construction is injectable; controllers use the actual Octokit API. */
export class GitHubClients extends Context.Service<GitHubClients>()(
  "@company/GitHubClients",
  {
    make: Effect.succeed({
      create: (token: string, connectionId: RecordId<"connection">) =>
        new ThrottledOctokit({
          auth: token,
          request: { timeout: 15_000 },
          throttle: {
            // Shared across clients for this connection in this process, including discovery.
            id: connectionId,
            // Long waits and exhausted retries return to the durable controller queue.
            onRateLimit: (retryAfter, _options, _client, retryCount) =>
              retryAfter <= 60 && retryCount < 1,
            onSecondaryRateLimit: (retryAfter, _options, _client, retryCount) =>
              retryAfter <= 60 && retryCount < 1,
          },
          // Controllers report sanitized failures through Effect logging.
          log: {
            debug: () => {},
            info: () => {},
            warn: () => {},
            error: () => {},
          },
        }),
    }),
  }
) {
  static readonly layer = Layer.effect(this, this.make)
}

export const GitHubConnector = defineConnectorServer(GitHub, {
  createClient: (token, connection) =>
    Effect.gen(function* () {
      const clients = yield* GitHubClients
      return clients.create(Redacted.value(token), connection.id)
    }),
})

function requestFailure(error: unknown, now: number): ConnectionError {
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? error.status
      : undefined
  let headers: Record<string, unknown> = {}
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = error.response
    if (
      typeof response === "object" &&
      response !== null &&
      "headers" in response &&
      typeof response.headers === "object" &&
      response.headers !== null
    )
      headers = Object.fromEntries(Object.entries(response.headers))
  }
  if (
    status === 429 ||
    (status === 403 &&
      (headers["retry-after"] !== undefined ||
        headers["x-ratelimit-remaining"] === "0" ||
        (error instanceof Error && /\bsecondary rate\b/i.test(error.message))))
  ) {
    const retry = Number(headers["retry-after"])
    const reset = Number(headers["x-ratelimit-reset"]) * 1000 - now
    return new ConnectionError({
      reason: "rateLimit",
      message:
        "GitHub rate limit reached; synchronization will resume automatically.",
      retryAfter:
        Number.isFinite(retry) && retry > 0
          ? retry
          : Number.isFinite(reset) && reset > 0
            ? Math.ceil(reset / 1000)
            : 60,
    })
  }
  if (status === 401 || status === 403 || status === 404)
    return new ConnectionError({
      reason: "authorization",
      message:
        "GitHub access is unavailable. Check the token, repository permissions, and account.",
    })
  // Never retain the SDK error: it can contain request headers and private response bodies.
  return new ConnectionError({
    reason: "unavailable",
    message: "GitHub request failed. Synchronization will retry.",
  })
}

export const githubRequest = <A>(
  request: (signal: AbortSignal) => Promise<A>
) =>
  Effect.tryPromise({ try: request, catch: (error) => error }).pipe(
    Effect.catch((error) =>
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis
        return yield* Effect.fail(requestFailure(error, now))
      })
    )
  )

/** Report failures on the resource being reconciled, so one inaccessible repository
 * cannot toggle connection health and repeatedly wake every sibling repository. */
export function withGitHubConnection<E, R, HE, HR>(
  id: RecordId<"connection">,
  report: (error: ConnectionError | null) => Effect.Effect<void, HE, HR>,
  run: (client: Octokit) => Effect.Effect<void | ReconcileResult, E, R>
) {
  return Effect.gen(function* () {
    const client = yield* GitHubConnector.client(id)
    const result = yield* run(client)
    yield* report(null)
    return result
  }).pipe(
    Effect.catchIf(
      (error): error is ConnectionError => error instanceof ConnectionError,
      (error) =>
        Effect.gen(function* () {
          if (error.reason === "disabled") return undefined
          yield* report(error)
          if (
            error.reason === "authorization" ||
            error.reason === "connectorMismatch"
          )
            return undefined
          if (error.reason === "rateLimit")
            return {
              requeueAfter:
                `${Math.max(1, error.retryAfter ?? 60)} seconds` as const,
            }
          return yield* Effect.fail(error)
        })
    )
  )
}
