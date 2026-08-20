import type { Action, ActionInput, ActionOutput } from "./definition/action"
import {
  type ModelObject,
  type ModelCatalog,
  modelObjects,
} from "./definition/model"
import type {
  ObjectDeleteInput,
  ObjectGetInput,
  ObjectType,
  ObjectCreateInput,
  ObjectRecord,
  ObjectUpdateRequest,
} from "./definition/object"
import type {
  Batch,
  IdempotencyKey,
  ListRequest,
  MutationOptions,
  Page,
} from "./definition/request"
import type { RecordId } from "./definition/schema"

export interface ApiClientOptions {
  /** Versioned API root. Defaults to the same-origin `/api/v1`. */
  readonly baseUrl?: string
  /** Override Fetch for tests, server runtimes, authentication, or tracing. */
  readonly fetch?: typeof globalThis.fetch
  /** Headers evaluated immediately before every request, such as an access token. */
  readonly getHeaders?: () => HeadersInit | Promise<HeadersInit>
  /** Static headers sent with every request. */
  readonly headers?: HeadersInit
}

export interface BatchGetRequest<TObject extends ObjectType> {
  readonly ids: ReadonlyArray<RecordId<TObject["id"]>>
}

export class ApiClientResponseError extends Error {
  readonly body: string
  readonly status: number

  constructor(status: number, body: string) {
    super(`API request failed with status ${status}.`)
    this.name = "ApiClientResponseError"
    this.status = status
    this.body = body
  }
}

type ActionsForObject<TObject extends ObjectType> =
  TObject["actions"][keyof TObject["actions"]]

type DefaultMethod<TEnabled extends boolean, TMethod> = TEnabled extends true
  ? TMethod
  : object

type DefaultObjectClient<TObject extends ObjectType> = {
  readonly batchGet: (
    request: BatchGetRequest<TObject>
  ) => Promise<Batch<ObjectRecord<TObject>>>
  readonly get: (
    input: ObjectGetInput<TObject>
  ) => Promise<ObjectRecord<TObject>>
  readonly list: (request?: ListRequest) => Promise<Page<ObjectRecord<TObject>>>
} & DefaultMethod<
  TObject["defaultActions"]["create"],
  {
    readonly create: (
      input: ObjectCreateInput<TObject>,
      options?: MutationOptions
    ) => Promise<ObjectRecord<TObject>>
  }
> &
  DefaultMethod<
    TObject["defaultActions"]["delete"],
    {
      readonly delete: (
        input: ObjectDeleteInput<TObject>,
        options?: MutationOptions
      ) => Promise<void>
    }
  > &
  DefaultMethod<
    TObject["defaultActions"]["update"],
    {
      readonly update: (
        input: ObjectUpdateRequest<TObject>,
        options?: MutationOptions
      ) => Promise<ObjectRecord<TObject>>
    }
  >

type ActionMethod<TAction extends Action> = (
  input: ActionInput<TAction>,
  options?: MutationOptions
) => Promise<ActionOutput<TAction>>

type ObjectClient<
  TObject extends ObjectType,
  TActions extends Action,
> = DefaultObjectClient<TObject> & {
  readonly [TAction in TActions as TAction["id"]]: ActionMethod<TAction>
}

/** An inferred client grouped by the globally unique collection of each object. */
export type ApiClient<TModel extends ModelCatalog> = {
  readonly [
    TObject in ModelObject<TModel> as TObject["collection"]
  ]: ObjectClient<TObject, ActionsForObject<TObject>>
}

interface RequestOptions {
  readonly body?: JsonValue
  readonly idempotencyKey?: IdempotencyKey
  readonly method: "DELETE" | "GET" | "PATCH" | "POST"
  readonly path: string
  readonly query?: URLSearchParams
}

interface JsonObject {
  readonly [key: string]: JsonValue
}

type JsonValue =
  | boolean
  | JsonObject
  | null
  | number
  | ReadonlyArray<JsonValue>
  | string

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl
}

function mutationOptions(options: MutationOptions | undefined) {
  return options?.idempotencyKey === undefined
    ? {}
    : { idempotencyKey: options.idempotencyKey }
}

/**
 * Constructs a browser-safe client directly from a live semantic contract.
 * No generated source file or module namespace is involved.
 */
export function createClient<const TModel extends ModelCatalog>(
  model: TModel,
  options: ApiClientOptions = {}
): ApiClient<TModel> {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? "/api/v1")
  const fetchRequest = options.fetch ?? globalThis.fetch

  async function request<TResult>(requestOptions: RequestOptions) {
    const headers = new Headers(options.headers)
    if (options.getHeaders !== undefined) {
      const requestHeaders = new Headers(await options.getHeaders())
      requestHeaders.forEach((value, key) => headers.set(key, value))
    }
    headers.set("accept", "application/json")

    if (requestOptions.body !== undefined) {
      headers.set("content-type", "application/json")
    }
    if (requestOptions.idempotencyKey !== undefined) {
      headers.set("idempotency-key", requestOptions.idempotencyKey)
    }

    const query = requestOptions.query?.toString()
    const url = `${baseUrl}${requestOptions.path}${query ? `?${query}` : ""}`
    const requestInit: RequestInit = {
      headers,
      method: requestOptions.method,
    }
    if (requestOptions.body !== undefined) {
      requestInit.body = JSON.stringify(requestOptions.body)
    }
    const response = await fetchRequest(url, requestInit)

    if (!response.ok) {
      throw new ApiClientResponseError(response.status, await response.text())
    }
    if (response.status === 204) return undefined

    const body: JsonValue = await response.json()
    // SAFETY: the server validates this endpoint against the same closed
    // semantic contract; runtime response decoding will strengthen this I/O
    // boundary when the portable decoder is introduced.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return body as TResult
  }

  const resources = new Map<string, object>()
  const objects = modelObjects(model)
  for (const object of objects) {
    const collectionPath = `/${object.collection}`
    const methods = new Map<string, object>()

    methods.set("list", (listRequest: ListRequest = {}) => {
      const query = new URLSearchParams()
      if (listRequest.pageSize !== undefined) {
        query.set("pageSize", String(listRequest.pageSize))
      }
      if (listRequest.pageToken !== undefined) {
        query.set("pageToken", listRequest.pageToken)
      }
      return request({ method: "GET", path: collectionPath, query })
    })

    methods.set(
      "batchGet",
      (batchRequest: { readonly ids: readonly string[] }) =>
        request({
          body: { ids: batchRequest.ids },
          method: "POST",
          path: `${collectionPath}:batchGet`,
        })
    )

    if (object.defaultActions.create) {
      methods.set(
        "create",
        (input: JsonValue, mutation: MutationOptions | undefined) =>
          request({
            body: input,
            method: "POST",
            path: collectionPath,
            ...mutationOptions(mutation),
          })
      )
    }

    methods.set("get", ({ id }: { readonly id: string }) =>
      request({
        method: "GET",
        path: `${collectionPath}/${encodeURIComponent(id)}`,
      })
    )

    if (object.defaultActions.update) {
      methods.set(
        "update",
        (
          input: JsonObject & { readonly id: string },
          mutation: MutationOptions | undefined
        ) => {
          const { id, ...body } = input
          return request({
            body,
            method: "PATCH",
            path: `${collectionPath}/${encodeURIComponent(id)}`,
            ...mutationOptions(mutation),
          })
        }
      )
    }

    if (object.defaultActions.delete) {
      methods.set(
        "delete",
        (
          { id }: { readonly id: string },
          mutation: MutationOptions | undefined
        ) =>
          request({
            method: "DELETE",
            path: `${collectionPath}/${encodeURIComponent(id)}`,
            ...mutationOptions(mutation),
          })
      )
    }

    for (const action of Object.values(object.actions)) {
      methods.set(
        action.id,
        (input: JsonObject, mutation: MutationOptions | undefined) => {
          const body = { ...input }
          const path = action.http.path.replace(
            /\{([^}/]+)\}/g,
            (_placeholder, property: string) => {
              const value = body[property]
              if (value === undefined) {
                throw new TypeError(
                  `Action '${object.id}.${action.id}' requires path property '${property}'.`
                )
              }
              delete body[property]
              // SAFETY: action binding validation permits only string-valued path schemas.
              // oxlint-disable-next-line typescript/no-unsafe-type-assertion
              return encodeURIComponent(value as string)
            }
          )
          const actionRequest = {
            method: action.http.method,
            path,
            ...mutationOptions(mutation),
          }
          return Object.keys(body).length === 0
            ? request(actionRequest)
            : request({ ...actionRequest, body })
        }
      )
    }

    resources.set(object.collection, Object.fromEntries(methods))
  }

  // SAFETY: defineModel validates collection and method uniqueness, and the
  // loops above materialize exactly the reads and actions represented by
  // ApiClient<TModel> from that same immutable definition.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return Object.fromEntries(resources) as ApiClient<TModel>
}
