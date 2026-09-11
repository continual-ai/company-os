import { Cause, Context, Effect, Exit } from "effect"
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
} from "effect/unstable/http"
import { HttpApiClient } from "effect/unstable/httpapi"

import {
  createModelClient,
  type ModelClient,
} from "#/runtime/client/http-client.ts"
import {
  type ApplicationHttpApi,
  createApplicationHttpApi,
} from "#/runtime/contract/application-http-api.ts"
import { customMethodParams } from "#/runtime/contract/http-custom-method.ts"
import type { RecordBatchInput } from "#/runtime/contract/record-batch.ts"
import type { RecordSearchInput } from "#/runtime/contract/record-search.ts"
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

type NativeGroups = HttpApiClient.Client<ApplicationHttpApi["eventGroup"]> &
  HttpApiClient.Client<ApplicationHttpApi["recordGroup"]>

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
    /** Typed SSE pages; checkpoints advance only after the consumer applies each page. */
    readonly stream: (
      cursor: string
    ) => ReturnType<NativeGroups["events"]["streamEvents"]>
  }
  readonly records: {
    readonly batchGet: (
      input: RecordBatchInput
    ) => ReturnType<NativeGroups["records"]["batchGetRecords"]>
    readonly search: (
      input: RecordSearchInput
    ) => ReturnType<NativeGroups["records"]["searchRecords"]>
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
export type Client<M extends ModelCatalog> = Promisified<ModelClient<M>> & {
  readonly events: {
    readonly list: Promisified<ApplicationEffectClient["events"]["list"]>
  }
  readonly records: Promisified<ApplicationEffectClient["records"]>
}

const APPLICATION_GROUPS = ["events", "records"] as const

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
  for (const group of APPLICATION_GROUPS) {
    if (Object.hasOwn(model.objects, group))
      throw new Error(
        `Object id '${group}' is reserved for an application client group.`
      )
  }
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
  // SAFETY: the contract adds exactly these two groups beside the model groups
  // that createModelClient addresses by generated endpoint id.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const groups = nativeClient as unknown as NativeGroups
  const application: ApplicationEffectClient = {
    events: {
      list: (query = {}) => groups.events.listEvents({ query }),
      stream: (cursor) =>
        groups.events.streamEvents({
          params: customMethodParams("stream"),
          query: { cursor },
        }),
    },
    records: {
      batchGet: (input) =>
        groups.records.batchGetRecords({
          params: customMethodParams("batchGet"),
          payload: input,
        }),
      search: (input) =>
        groups.records.searchRecords({
          params: customMethodParams("search"),
          payload: input,
        }),
    },
  }
  return { ...createModelClient(model, nativeClient), ...application }
}

function promisify(value: unknown, path: string): unknown {
  if (typeof value === "function") {
    // SAFETY: every function on an EffectClient takes one input and returns an Effect.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const method = value as (
      ...args: unknown[]
    ) => Effect.Effect<unknown, unknown>
    return (...args: unknown[]) => runClientEffect(method(...args))
  }
  if (typeof value === "object" && value !== null)
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => `${path}${key}` !== "events.stream")
        .map(([key, member]) => [key, promisify(member, `${path}${key}.`)])
    )
  return value
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
  // SAFETY: promisify mirrors the EffectClient shape one level at a time.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return promisify(createEffectClient(model, options), "") as Client<M>
}
