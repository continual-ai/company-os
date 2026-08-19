import type {
  ActionInput,
  ActionOutput,
  ActionSubjectId,
  DefinedAction,
} from "./definition/action"
import type { DefinedApi } from "./definition/api"
import type {
  DefinedObject,
  ObjectCreateInput,
  ObjectRecord,
  ObjectUpdateInput,
} from "./definition/object"
import type {
  Batch,
  IdempotencyKey,
  ListRequest,
  MutationOptions,
  Page,
} from "./definition/operation"
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

export interface BatchGetRequest<TObject extends DefinedObject> {
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

type ApiModule<TApi extends DefinedApi> = TApi["modules"][number]

type ApiObject<TApi extends DefinedApi> = ApiModule<TApi>["objects"][number]

type ApiAction<TApi extends DefinedApi> = ApiModule<TApi>["actions"][number]

type ActionsForObject<
  TApi extends DefinedApi,
  TObject extends DefinedObject,
> = Extract<ApiAction<TApi>, { subjectId: TObject["id"] }>

type EnabledMethod<TEnabled extends boolean, TMethod> = TEnabled extends true
  ? TMethod
  : object

type StandardObjectClient<TObject extends DefinedObject> = EnabledMethod<
  TObject["operations"]["batchGet"],
  {
    readonly batchGet: (
      request: BatchGetRequest<TObject>
    ) => Promise<Batch<ObjectRecord<TObject>>>
  }
> &
  EnabledMethod<
    TObject["operations"]["create"],
    {
      readonly create: (
        input: ObjectCreateInput<TObject>,
        options?: MutationOptions
      ) => Promise<ObjectRecord<TObject>>
    }
  > &
  EnabledMethod<
    TObject["operations"]["delete"],
    {
      readonly delete: (
        id: RecordId<TObject["id"]>,
        options?: MutationOptions
      ) => Promise<void>
    }
  > &
  EnabledMethod<
    TObject["operations"]["get"],
    {
      readonly get: (
        id: RecordId<TObject["id"]>
      ) => Promise<ObjectRecord<TObject>>
    }
  > &
  EnabledMethod<
    TObject["operations"]["list"],
    {
      readonly list: (
        request?: ListRequest
      ) => Promise<Page<ObjectRecord<TObject>>>
    }
  > &
  EnabledMethod<
    TObject["operations"]["update"],
    {
      readonly update: (
        id: RecordId<TObject["id"]>,
        input: ObjectUpdateInput<TObject>,
        options?: MutationOptions
      ) => Promise<ObjectRecord<TObject>>
    }
  >

type ActionMethod<TAction extends DefinedAction> =
  keyof ActionInput<TAction> extends never
    ? (
        subjectId: ActionSubjectId<TAction>,
        options?: MutationOptions
      ) => Promise<ActionOutput<TAction>>
    : (
        subjectId: ActionSubjectId<TAction>,
        input: ActionInput<TAction>,
        options?: MutationOptions
      ) => Promise<ActionOutput<TAction>>

type ObjectClient<
  TObject extends DefinedObject,
  TActions extends DefinedAction,
> = StandardObjectClient<TObject> & {
  readonly [TAction in TActions as TAction["verb"]]: ActionMethod<TAction>
}

/** An inferred client grouped by the globally unique collection of each object. */
export type ApiClient<TApi extends DefinedApi> = {
  readonly [TObject in ApiObject<TApi> as TObject["collection"]]: ObjectClient<
    TObject,
    ActionsForObject<TApi, TObject>
  >
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

function encodeRecordId(id: string): string {
  return encodeURIComponent(id)
}

/**
 * Constructs a browser-safe client directly from a live semantic contract.
 * No generated source file or module namespace is involved.
 */
export function createClient<const TApi extends DefinedApi>(
  api: TApi,
  options: ApiClientOptions = {}
): ApiClient<TApi> {
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
  const objects = api.modules.flatMap((module) => module.objects)
  const actions = api.modules.flatMap((module) => module.actions)

  for (const object of objects) {
    const collectionPath = `/${object.collection}`
    const methods = new Map<string, object>()

    if (object.operations.list) {
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
    }

    if (object.operations.batchGet) {
      methods.set(
        "batchGet",
        (batchRequest: { readonly ids: readonly string[] }) =>
          request({
            body: { ids: batchRequest.ids },
            method: "POST",
            path: `${collectionPath}:batchGet`,
          })
      )
    }

    if (object.operations.create) {
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

    if (object.operations.get) {
      methods.set("get", (id: string) =>
        request({
          method: "GET",
          path: `${collectionPath}/${encodeRecordId(id)}`,
        })
      )
    }

    if (object.operations.update) {
      methods.set(
        "update",
        (id: string, input: JsonValue, mutation: MutationOptions | undefined) =>
          request({
            body: input,
            method: "PATCH",
            path: `${collectionPath}/${encodeRecordId(id)}`,
            ...mutationOptions(mutation),
          })
      )
    }

    if (object.operations.delete) {
      methods.set(
        "delete",
        (id: string, mutation: MutationOptions | undefined) =>
          request({
            method: "DELETE",
            path: `${collectionPath}/${encodeRecordId(id)}`,
            ...mutationOptions(mutation),
          })
      )
    }

    for (const action of actions.filter(
      (candidate) => candidate.subjectId === object.id
    )) {
      const emptyInput =
        action.input.kind === "struct" &&
        Object.keys(action.input.fields).length === 0

      if (emptyInput) {
        methods.set(
          action.verb,
          (id: string, mutation: MutationOptions | undefined) =>
            request({
              body: {},
              method: "POST",
              path: `${collectionPath}/${encodeRecordId(id)}:${action.verb}`,
              ...mutationOptions(mutation),
            })
        )
      } else {
        methods.set(
          action.verb,
          (
            id: string,
            input: JsonValue,
            mutation: MutationOptions | undefined
          ) =>
            request({
              body: input,
              method: "POST",
              path: `${collectionPath}/${encodeRecordId(id)}:${action.verb}`,
              ...mutationOptions(mutation),
            })
        )
      }
    }

    resources.set(object.collection, Object.fromEntries(methods))
  }

  // SAFETY: defineApi validates collection and method uniqueness, and the
  // loops above materialize exactly the operations represented by
  // ApiClient<TApi> from that same immutable definition.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return Object.fromEntries(resources) as ApiClient<TApi>
}
