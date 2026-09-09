import type { Effect, Schema } from "effect"
import type { HttpClientError } from "effect/unstable/http"

import { customMethodParams } from "#/runtime/contract/http-custom-method.ts"
import {
  httpEndpointId,
  linkHttpEndpointId,
} from "#/runtime/contract/http-endpoint.ts"
import {
  isStandardActionId,
  type Action,
  type StandardActionId,
} from "#/runtime/model/definition/action.ts"
import type { ApiError } from "#/runtime/model/definition/error.ts"
import type {
  LinkTraversal,
  LinkType,
} from "#/runtime/model/definition/link.ts"
import type {
  ModelObjectCreateInput,
  ModelObjectUpdateInput,
} from "#/runtime/model/definition/model-input.ts"
import {
  type ModelCatalog,
  type ModelEndpointObjectTypeId,
  type ModelObject,
  modelObjectLinkTraversals,
  modelObjects,
} from "#/runtime/model/definition/model.ts"
import type {
  ObjectBatchDeleteInput,
  ObjectBatchGetInput,
  ObjectDeleteInput,
  ObjectGetInput,
  ObjectRecord,
  ObjectType,
  ObjectUpdateInput,
} from "#/runtime/model/definition/object.ts"
import type { CustomQuery } from "#/runtime/model/definition/query.ts"
import type {
  Batch,
  ListRequest,
  Page,
} from "#/runtime/model/definition/request.ts"
import type {
  InferInputSchema,
  InferSchema,
  RecordIdentifier,
} from "#/runtime/model/definition/schema.ts"
import type {
  LinkListInput,
  LinkMutationInput,
} from "#/runtime/model/link-input.ts"

type OperationId<
  TOperation extends string,
  TObject extends ObjectType,
  TScope extends "collection" | "object",
> = `${TOperation}${Capitalize<
  TScope extends "collection" ? TObject["collection"] : TObject["id"]
>}`

type UpdatePayload<
  TModel extends ModelCatalog,
  TObject extends ModelObject<TModel>,
> = Omit<ModelObjectUpdateInput<TModel, TObject>, "id">
type DeleteQuery<TObject extends ObjectType> = Pick<
  ObjectDeleteInput<TObject>,
  "etag"
>

type NonEmpty<T> = keyof T extends never ? never : T

type CustomOperation = Action | CustomQuery
type ObjectCustomOperations<TObject extends ObjectType> = TObject["actions"] &
  TObject["queries"]
type InputOf<T extends CustomOperation> = InferInputSchema<T["input"]>
type OutputOf<T extends CustomOperation> = InferSchema<T["output"]>

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
    { readonly query: ListRequest<TObject> },
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
  TAction extends CustomOperation,
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
    TAction in ObjectCustomOperations<TObject>[keyof ObjectCustomOperations<TObject>] as TAction extends CustomOperation
      ? TAction["id"] extends StandardActionId
        ? never
        : OperationId<TAction["id"], TObject, TAction["scope"]>
      : never
  ]: TAction extends CustomOperation
    ? ActionClientMethod<TObject, TAction>
    : never
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

type ClientLinkSide<TObject extends ObjectType, TLink> = TLink extends LinkType
  ?
      | (ClientEndpointMatches<TObject, TLink["forward"]["from"]> extends true
          ? {
              readonly direction: "forward"
              readonly link: TLink
              readonly side: TLink["forward"]
              readonly target: TLink["reverse"]
            }
          : never)
      | (ClientEndpointMatches<TObject, TLink["reverse"]["from"]> extends true
          ? {
              readonly direction: "reverse"
              readonly link: TLink
              readonly side: TLink["reverse"]
              readonly target: TLink["forward"]
            }
          : never)
  : never

type ClientLinkSides<
  TModel extends ModelCatalog,
  TObject extends ObjectType,
> = TModel["links"][keyof TModel["links"]] extends infer TLink
  ? ClientLinkSide<TObject, TLink>
  : never

type RelatedRecord<O extends ObjectType> = O extends ObjectType
  ? ObjectRecord<O> & { readonly objectType: O["id"] }
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
        Page<
          RelatedRecord<
            Extract<
              ModelObject<TModel>,
              {
                readonly id: ModelEndpointObjectTypeId<TModel, TTarget["from"]>
              }
            >
          >
        >
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
    TAction in ObjectCustomOperations<TObject>[keyof ObjectCustomOperations<TObject>] as TAction extends CustomOperation
      ? TAction["id"] extends StandardActionId
        ? never
        : TAction["id"]
      : never
  ]: TAction extends CustomOperation
    ? DirectClientMethod<InputOf<TAction>, OutputOf<TAction>>
    : never
}

export type ModelObjectClient<
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
  readonly [TObject in ModelObject<TModel> as TObject["id"]]: ModelObjectClient<
    TModel,
    TObject
  >
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
    const methods: Record<string, unknown> = {
      batchGet: (input: ObjectBatchGetInput<ObjectType>) =>
        endpoint("batchGet")({
          params: customMethodParams("batchGet"),
          payload: input,
        }),
      get: (input: ObjectGetInput<ObjectType>) =>
        endpoint("get")({ params: input }),
      list: (input: ListRequest = {}) => list({ query: input }),
    }
    if (Object.hasOwn(object.actions, "batchDelete")) {
      methods.batchDelete = (input: ObjectBatchDeleteInput<ObjectType>) =>
        endpoint("batchDelete")({
          params: customMethodParams("batchDelete"),
          payload: input,
        })
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
    for (const action of [
      ...Object.values(object.actions),
      ...Object.values(object.queries),
    ]) {
      if (isStandardActionId(action.id)) continue
      const actionEndpoint = endpoint(action.id, action.scope)
      methods[action.id] = (input: Readonly<Record<string, unknown>>) => {
        const { id, ...payload } = input
        return actionEndpoint({
          params: customMethodParams(
            action.id,
            action.scope === "object" ? { id } : {}
          ),
          payload: action.scope === "object" ? payload : input,
        })
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
          )({
            params: customMethodParams("link", { id: input.id }),
            payload: { target: input.target },
          })
        if (
          traversal.traversal.cardinality !== "one" &&
          traversal.target.cardinality !== "one"
        ) {
          traversalMethods.unlink = (input: LinkMutationInput) =>
            nativeMethod(
              group,
              linkHttpEndpointId("unlink", object, traversal)
            )({
              params: customMethodParams("unlink", { id: input.id }),
              payload: { target: input.target },
            })
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
