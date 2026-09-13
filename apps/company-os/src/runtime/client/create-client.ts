import { Cause, Context, Effect, Exit } from "effect"
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
} from "effect/unstable/http"
import { HttpApiClient } from "effect/unstable/httpapi"

import {
  createModelClient,
  mapModelClient,
  type ModelClient,
} from "#/runtime/client/http-client.ts"
import type {
  ReadProjection,
  PolymorphicReads,
} from "#/runtime/client/read-types.ts"
import {
  type ApplicationHttpApi,
  createApplicationHttpApi,
} from "#/runtime/contract/application-http-api.ts"
import { customMethodParams } from "#/runtime/contract/http-custom-method.ts"
import type { ModelObject } from "#/runtime/model/definition/model.ts"
import type { ModelCatalog } from "#/runtime/model/index.ts"

/** Object types a committed write touched, reported by the server per response. */
export const ClientChanges = Context.Reference<Set<string> | undefined>(
  "@company/ClientChanges",
  { defaultValue: () => undefined }
)

/** Runs a client Effect as a Promise, surfacing the decoded ApiError as the rejection. */
export async function runClientEffect<A, E>(
  effect: Effect.Effect<A, E>,
  signal?: AbortSignal
): Promise<A> {
  const exit = await Effect.runPromiseExit(effect, { signal })
  if (Exit.isFailure(exit)) throw Cause.squash(exit.cause)
  return exit.value
}

export interface ClientOptions {
  /** Absolute origin of the application; a function is resolved on every request. */
  readonly baseUrl: string | (() => string | Promise<string>)
  /** Replaces the global fetch, for example to run the transport in-process. */
  readonly fetch?: typeof globalThis.fetch
  /** Headers added to every request, such as forwarded identity. */
  readonly headers?:
    | Readonly<Record<string, string>>
    | (() => Readonly<Record<string, string>>)
}

type NativeGroups = HttpApiClient.Client<ApplicationHttpApi["eventGroup"]>

type Request<T> = T extends (request: infer R) => unknown ? R : never

export type EventListQuery = Request<
  NativeGroups["events"]["listEvents"]
>["query"]

/** Application capabilities outside the model, exposed beside the object client. */
export interface ApplicationEffectClient {
  readonly events: {
    readonly list: (
      query?: EventListQuery
    ) => ReturnType<NativeGroups["events"]["listEvents"]>
  }
  readonly changes: {
    readonly list: (query?: {
      readonly cursor?: string
    }) => ReturnType<NativeGroups["events"]["listChanges"]>
    /** Typed SSE pages; checkpoints advance only after the consumer applies each page. */
    readonly stream: (
      cursor: string
    ) => ReturnType<NativeGroups["events"]["streamChanges"]>
  }
}

/** Every exposed object by id, plus the application groups. Methods return Effects. */
export type EffectClient<M extends ModelCatalog> = ModelClient<M> &
  ApplicationEffectClient

type Promisified<T> = T extends (
  ...args: infer A
) => Effect.Effect<infer R, unknown>
  ? (...args: A) => Promise<R>
  : T extends object
    ? { readonly [K in keyof T]: Promisified<T[K]> }
    : T

/** The Promise projection of an EffectClient. Event streaming stays on the Effect client. */
export type Client<M extends ModelCatalog> = Omit<
  Promisified<ModelClient<M>>,
  ModelObject<M>["id"]
> & {
  readonly [O in ModelObject<M> as O["id"]]: ReadProjection<
    M,
    O,
    Promisified<ModelClient<M>[O["id"]]>,
    "promise"
  >
} & {
  readonly events: {
    readonly list: Promisified<ApplicationEffectClient["events"]["list"]>
  }
  readonly changes: {
    readonly list: Promisified<ApplicationEffectClient["changes"]["list"]>
  }
  readonly records: PolymorphicReads<M, "promise"> & {
    readonly search: Promisified<ModelClient<M>["records"]["search"]>
  }
}

function resolveHeaders(
  headers: ClientOptions["headers"]
): Readonly<Record<string, string>> {
  return typeof headers === "function" ? headers() : (headers ?? {})
}

/**
 * Builds the typed Effect client for a model's application contract. The same
 * contract drives the server handlers and OpenAPI, so this client is complete for
 * every enabled object, Action, Link, and application group with no generated code.
 */
export function createEffectClient<M extends ModelCatalog>(
  model: M,
  options: ClientOptions
): EffectClient<M> {
  const { api } = createApplicationHttpApi(model)
  const { baseUrl, headers } = options
  const withOrigin =
    typeof baseUrl === "string"
      ? HttpClient.mapRequest(HttpClientRequest.prependUrl(baseUrl))
      : HttpClient.mapRequestEffect((request) =>
          Effect.promise(async () =>
            HttpClientRequest.prependUrl(request, await baseUrl())
          )
        )
  const withHeaders =
    headers === undefined
      ? (http: HttpClient.HttpClient) => http
      : HttpClient.mapRequest((request) =>
          HttpClientRequest.setHeaders(request, resolveHeaders(headers))
        )
  const nativeClient = Effect.runSync(
    HttpApiClient.make(api, {
      transformClient: (http) =>
        http.pipe(
          withOrigin,
          withHeaders,
          HttpClient.tap((response) =>
            Effect.gen(function* () {
              const changes = yield* ClientChanges
              if (response.status < 400)
                for (const type of response.headers["x-model-changes"]?.split(
                  ","
                ) ?? [])
                  changes?.add(type)
            })
          )
        ),
    }).pipe(
      Effect.provide(FetchHttpClient.layer),
      options.fetch === undefined
        ? (effect) => effect
        : Effect.provideService(FetchHttpClient.Fetch, options.fetch)
    )
  )
  const application: ApplicationEffectClient = {
    events: {
      list: (query = {}) => nativeClient.events.listEvents({ query }),
    },
    changes: {
      list: (query = {}) => nativeClient.events.listChanges({ query }),
      stream: (cursor) =>
        nativeClient.events.streamChanges({
          params: customMethodParams("stream"),
          query: { cursor },
        }),
    },
  }
  return {
    ...createModelClient(model, nativeClient),
    ...application,
  }
}

/**
 * The typed Promise client for a model's application contract. Optional apps,
 * scripts, and tests call the central application through it; each method
 * rejects with the decoded ApiError when an operation fails.
 */
export function createClient<M extends ModelCatalog>(
  model: M,
  options: ClientOptions
): Client<M> {
  const client = createEffectClient(model, options)
  // SAFETY: every model operation is projected once; event streaming remains Effect-only.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return {
    ...mapModelClient(
      model,
      client,
      (_contract, invoke) =>
        (input: unknown = {}) =>
          runClientEffect(invoke(input))
    ),
    events: {
      list: (input?: EventListQuery) =>
        runClientEffect(client.events.list(input)),
    },
  } as Client<M>
}
