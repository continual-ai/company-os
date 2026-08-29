import type { Effect, Schema } from "effect"
import type { HttpClientError } from "effect/unstable/http"

import {
  isStandardActionId,
  type Action,
  type StandardActionId,
} from "./definition/action"
import type { ApiError } from "./definition/error"
import type { LinkTraversal, LinkType } from "./definition/link"
import {
  type ModelCatalog,
  type ModelEndpointObjectTypeId,
  type ModelLinkTraversal,
  type ModelObjectCreateInput,
  type ModelObjectUpdateInput,
  type ModelObject,
  modelObjectLinkTraversals,
  modelObjects,
} from "./definition/model"
import type {
  ObjectBatchDeleteInput,
  ObjectBatchGetInput,
  ObjectDeleteInput,
  ObjectGetInput,
  ObjectRecord,
  ObjectRef,
  ObjectType,
  ObjectUpdateInput,
} from "./definition/object"
import type { Batch, ListRequest, Page } from "./definition/request"
import type {
  InferInputSchema,
  InferSchema,
  RecordIdentifier,
  StructSchema,
} from "./definition/schema"
import type { LinkListInput, LinkMutationInput } from "./effect-link-service"

function pascalCase(value: string): string {
  return value
    .replace(/(^|[^a-zA-Z0-9]+)([a-zA-Z0-9])/g, (_match, _prefix, char) =>
      char.toUpperCase()
    )
    .replace(/[^a-zA-Z0-9]/g, "")
}

/** Returns the stable operation identifier shared by generated contracts and handlers. */
export function httpEndpointId(
  operation: string,
  object: ObjectType,
  scope?: "collection" | "object"
): string {
  const target =
    scope === "collection" ||
    operation === "list" ||
    operation === "search" ||
    operation === "batchGet" ||
    operation === "batchDelete"
      ? object.collection
      : object.id
  return `${operation}${pascalCase(target)}`
}

/** Stable endpoint identifier for one generated Link traversal operation. */
export function linkHttpEndpointId(
  operation: "link" | "list" | "unlink",
  object: ObjectType,
  traversal: ModelLinkTraversal
): string {
  return `${operation}${pascalCase(object.id)}${pascalCase(traversal.traversal.key)}`
}

type OperationId<
  TOperation extends string,
  TObject extends ObjectType,
  TScope extends "collection" | "object",
> = `${TOperation}${Capitalize<
  TScope extends "collection" ? TObject["collection"] : TObject["id"]
>}`

type ListQuery = Pick<ListRequest, "pageSize" | "pageToken">
type UpdatePayload<
  TModel extends ModelCatalog,
  TObject extends ModelObject<TModel>,
> = Omit<ModelObjectUpdateInput<TModel, TObject>, "id">
type DeleteQuery<TObject extends ObjectType> = Pick<
  ObjectDeleteInput<TObject>,
  "etag"
>

type NonEmpty<T> = keyof T extends never ? never : T

type InputOf<TAction extends Action> =
  TAction extends Action<
    string,
    string,
    "collection" | "object",
    infer TInput extends StructSchema
  >
    ? InferInputSchema<TInput>
    : never

type OutputOf<TAction extends Action> =
  TAction extends Action<
    string,
    string,
    "collection" | "object",
    StructSchema,
    infer TOutput extends StructSchema
  >
    ? InferSchema<TOutput>
    : never

type ClientRequestPart<TKey extends string, TValue> = [TValue] extends [never]
  ? object
  : { readonly [TPart in TKey]: TValue }

type ClientMethod<TRequest, TOutput> = (
  request: TRequest
) => Effect.Effect<
  TOutput,
  ApiError | HttpClientError.HttpClientError | Schema.SchemaError
>

type StandardClient<
  TModel extends ModelCatalog,
  TObject extends ModelObject<TModel>,
> = {
  readonly [TId in OperationId<"list", TObject, "collection">]: ClientMethod<
    { readonly query: ListQuery },
    Page<ObjectRecord<TObject>>
  >
} & {
  readonly [TId in OperationId<"search", TObject, "collection">]: ClientMethod<
    { readonly payload: ListRequest<TObject> },
    Page<ObjectRecord<TObject>>
  >
} & {
  readonly [
    TId in OperationId<"batchGet", TObject, "collection">
  ]: ClientMethod<
    { readonly payload: ObjectBatchGetInput<TObject> },
    Batch<ObjectRecord<TObject>>
  >
} & ("batchDelete" extends keyof TObject["actions"]
    ? {
        readonly [
          TId in OperationId<"batchDelete", TObject, "collection">
        ]: ClientMethod<
          { readonly payload: ObjectBatchDeleteInput<TObject> },
          void
        >
      }
    : object) &
  ("create" extends keyof TObject["actions"]
    ? {
        readonly [
          TId in OperationId<"create", TObject, "object">
        ]: ClientMethod<
          { readonly payload: ModelObjectCreateInput<TModel, TObject> },
          ObjectRecord<TObject>
        >
      }
    : object) & {
    readonly [TId in OperationId<"get", TObject, "object">]: ClientMethod<
      { readonly params: { readonly id: RecordIdentifier<TObject["id"]> } },
      ObjectRecord<TObject>
    >
  } & ("update" extends keyof TObject["actions"]
    ? {
        readonly [
          TId in OperationId<"update", TObject, "object">
        ]: ClientMethod<
          {
            readonly params: Pick<ObjectUpdateInput<TObject>, "id">
            readonly payload: UpdatePayload<TModel, TObject>
          },
          ObjectRecord<TObject>
        >
      }
    : object) &
  ("delete" extends keyof TObject["actions"]
    ? {
        readonly [
          TId in OperationId<"delete", TObject, "object">
        ]: ClientMethod<
          {
            readonly params: Pick<ObjectDeleteInput<TObject>, "id">
            readonly query: DeleteQuery<TObject>
          },
          void
        >
      }
    : object)

type ActionClientMethod<
  TObject extends ObjectType,
  TAction extends Action,
> = ClientMethod<
  ClientRequestPart<
    "params",
    TAction["scope"] extends "object"
      ? { readonly id: RecordIdentifier<TObject["id"]> }
      : never
  > &
    ClientRequestPart<"payload", NonEmpty<Omit<InputOf<TAction>, "id">>>,
  OutputOf<TAction>
>

type ActionClient<TObject extends ObjectType> = {
  readonly [
    TAction in TObject["actions"][keyof TObject["actions"]] as TAction extends Action
      ? TAction["id"] extends StandardActionId
        ? never
        : OperationId<TAction["id"], TObject, TAction["scope"]>
      : never
  ]: TAction extends Action ? ActionClientMethod<TObject, TAction> : never
}

type ObjectHttpClient<
  TModel extends ModelCatalog,
  TObject extends ModelObject<TModel>,
> = StandardClient<TModel, TObject> & ActionClient<TObject>

/** Typed decoded-only view of Effect's native HttpApiClient for a model. */
export type ModelHttpClient<TModel extends ModelCatalog> = {
  readonly [TObject in ModelObject<TModel> as TObject["id"]]: ObjectHttpClient<
    TModel,
    TObject
  >
}

type ClientEndpointMatches<
  TObject extends ObjectType,
  TEndpoint extends LinkTraversal["from"],
> = TEndpoint["kind"] extends "object"
  ? TEndpoint["typeId"] extends TObject["id"]
    ? true
    : false
  : TEndpoint["typeId"] extends keyof TObject["interfaces"]
    ? true
    : false

type ClientLinkSide<TObject extends ObjectType, TLink> =
  TLink extends LinkType<
    string,
    infer TForward extends LinkTraversal,
    infer TReverse extends LinkTraversal
  >
    ?
        | (ClientEndpointMatches<TObject, TForward["from"]> extends true
            ? {
                readonly direction: "forward"
                readonly link: TLink
                readonly side: TForward
                readonly target: TReverse
              }
            : never)
        | (ClientEndpointMatches<TObject, TReverse["from"]> extends true
            ? {
                readonly direction: "reverse"
                readonly link: TLink
                readonly side: TReverse
                readonly target: TForward
              }
            : never)
    : never

type ClientLinkSides<
  TModel extends ModelCatalog,
  TObject extends ObjectType,
> = TModel["links"][keyof TModel["links"]] extends infer TLink
  ? ClientLinkSide<TObject, TLink>
  : never

type LinkTraversalClient<TModel extends ModelCatalog, TSide> = TSide extends {
  readonly direction: "forward" | "reverse"
  readonly link: infer TLink extends LinkType
  readonly side: infer TTraversal extends LinkTraversal
  readonly target: infer TTarget extends LinkTraversal
}
  ? {
      readonly list: ClientMethod<
        LinkListInput,
        Page<ObjectRef<ModelEndpointObjectTypeId<TModel, TTarget["from"]>>>
      >
    } & (TLink["writeFrom"] extends TTraversal["key"]
      ? {
          readonly link: ClientMethod<LinkMutationInput, void>
        } & (TTraversal["cardinality"] extends "one"
          ? object
          : TTarget["cardinality"] extends "one"
            ? object
            : { readonly unlink: ClientMethod<LinkMutationInput, void> })
      : object)
  : never

type ObjectLinkClient<
  TModel extends ModelCatalog,
  TObject extends ObjectType,
> = {
  readonly [
    TSide in ClientLinkSides<TModel, TObject> as TSide["side"]["key"]
  ]: LinkTraversalClient<TModel, TSide>
}

type DirectClientMethod<TInput, TOutput> = (
  input: TInput
) => Effect.Effect<
  TOutput,
  ApiError | HttpClientError.HttpClientError | Schema.SchemaError
>

type DirectActionClient<TObject extends ObjectType> = {
  readonly [
    TAction in TObject["actions"][keyof TObject["actions"]] as TAction extends Action
      ? TAction["id"] extends StandardActionId
        ? never
        : TAction["id"]
      : never
  ]: TAction extends Action
    ? DirectClientMethod<InputOf<TAction>, OutputOf<TAction>>
    : never
}

type DirectObjectClient<
  TModel extends ModelCatalog,
  TObject extends ModelObject<TModel>,
> = {
  readonly batchGet: DirectClientMethod<
    ObjectBatchGetInput<TObject>,
    Batch<ObjectRecord<TObject>>
  >
  readonly get: DirectClientMethod<
    ObjectGetInput<TObject>,
    ObjectRecord<TObject>
  >
  readonly list: (
    request?: ListRequest<TObject>
  ) => Effect.Effect<
    Page<ObjectRecord<TObject>>,
    ApiError | HttpClientError.HttpClientError | Schema.SchemaError
  >
} & ("batchDelete" extends keyof TObject["actions"]
  ? {
      readonly batchDelete: DirectClientMethod<
        ObjectBatchDeleteInput<TObject>,
        void
      >
    }
  : object) &
  ("create" extends keyof TObject["actions"]
    ? {
        readonly create: DirectClientMethod<
          ModelObjectCreateInput<TModel, TObject>,
          ObjectRecord<TObject>
        >
      }
    : object) &
  ("delete" extends keyof TObject["actions"]
    ? {
        readonly delete: DirectClientMethod<ObjectDeleteInput<TObject>, void>
      }
    : object) &
  ("update" extends keyof TObject["actions"]
    ? {
        readonly update: DirectClientMethod<
          ModelObjectUpdateInput<TModel, TObject>,
          ObjectRecord<TObject>
        >
      }
    : object) &
  DirectActionClient<TObject> &
  ObjectLinkClient<TModel, TObject>

/** One noun-oriented model client generated from the native Effect contract. */
export type ModelClient<TModel extends ModelCatalog> = {
  readonly [
    TObject in ModelObject<TModel> as TObject["id"]
  ]: DirectObjectClient<TModel, TObject>
}

type NativeModelMethod = (request: unknown) => Effect.Effect<unknown, unknown>

function nativeGroup(nativeClient: object, object: ObjectType): object {
  const group = Reflect.get(nativeClient, object.id)
  if (typeof group !== "object" || group === null) {
    throw new Error(`HTTP client group '${object.id}' is missing.`)
  }
  return group
}

function nativeMethod(group: object, identifier: string): NativeModelMethod {
  const method = Reflect.get(group, identifier)
  if (typeof method !== "function") {
    throw new Error(`HTTP endpoint '${identifier}' is missing.`)
  }
  // SAFETY: callers provide identifiers generated from the same closed model
  // that produced the native Effect client.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return method as NativeModelMethod
}

/** Projects the native Effect client as direct object, Action, and Link methods. */
export function createModelClient<TModel extends ModelCatalog>(
  model: TModel,
  nativeClient: object
): ModelClient<TModel> {
  const result: Record<string, Record<string, unknown>> = {}
  for (const object of modelObjects(model)) {
    const group = nativeGroup(nativeClient, object)
    const endpoint = (operation: string, scope?: "collection" | "object") =>
      nativeMethod(group, httpEndpointId(operation, object, scope))
    const list = endpoint("list")
    const search = endpoint("search")
    const methods: Record<string, unknown> = {
      batchGet: (input: ObjectBatchGetInput<ObjectType>) =>
        endpoint("batchGet")({ payload: input }),
      get: (input: ObjectGetInput<ObjectType>) =>
        endpoint("get")({ params: input }),
      list: (input: ListRequest = {}) =>
        input.filter === undefined && input.sort === undefined
          ? list({ query: input })
          : search({ payload: input }),
    }
    if (Object.hasOwn(object.actions, "batchDelete")) {
      methods.batchDelete = (input: ObjectBatchDeleteInput<ObjectType>) =>
        endpoint("batchDelete")({ payload: input })
    }
    if (Object.hasOwn(object.actions, "create")) {
      methods.create = (input: object) => endpoint("create")({ payload: input })
    }
    if (Object.hasOwn(object.actions, "delete")) {
      methods.delete = (input: ObjectDeleteInput<ObjectType>) => {
        const { id, ...query } = input
        return endpoint("delete")({ params: { id }, query })
      }
    }
    if (Object.hasOwn(object.actions, "update")) {
      methods.update = (
        input: Readonly<Record<string, unknown>> & {
          readonly id: RecordIdentifier
        }
      ) => {
        const { id, ...payload } = input
        return endpoint("update")({ params: { id }, payload })
      }
    }
    for (const action of Object.values(object.actions)) {
      if (isStandardActionId(action.id)) continue
      const actionEndpoint = endpoint(action.id, action.scope)
      methods[action.id] = (input: Readonly<Record<string, unknown>>) => {
        if (action.scope === "collection") {
          return actionEndpoint({ payload: input })
        }
        const { id, ...payload } = input
        return actionEndpoint({ params: { id }, payload })
      }
    }
    for (const traversal of modelObjectLinkTraversals(model, object)) {
      const traversalMethods: Record<string, unknown> = {
        list: (input: LinkListInput) => {
          const { id, ...query } = input
          return nativeMethod(
            group,
            linkHttpEndpointId("list", object, traversal)
          )({ params: { id }, query })
        },
      }
      if (traversal.writable) {
        traversalMethods.link = (input: LinkMutationInput) =>
          nativeMethod(
            group,
            linkHttpEndpointId("link", object, traversal)
          )({ params: input })
        if (
          traversal.traversal.cardinality !== "one" &&
          traversal.target.cardinality !== "one"
        ) {
          traversalMethods.unlink = (input: LinkMutationInput) =>
            nativeMethod(
              group,
              linkHttpEndpointId("unlink", object, traversal)
            )({ params: input })
        }
      }
      methods[traversal.traversal.key] = traversalMethods
    }
    result[object.id] = methods
  }
  // SAFETY: methods and traversal groups are exhaustively generated from the
  // same model and checked against its native Effect client above.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return result as ModelClient<TModel>
}
