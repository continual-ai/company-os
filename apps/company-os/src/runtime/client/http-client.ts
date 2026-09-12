import type { Effect, Schema } from "effect"
import type { HttpClientError } from "effect/unstable/http"

import {
  httpOperation,
  httpOperationRequest,
} from "#/runtime/contract/http-operation.ts"
import { modelOperations } from "#/runtime/contract/operations.ts"
import { type Action } from "#/runtime/model/definition/action.ts"
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
  modelObjects,
  type ModelCatalog,
  type ModelEndpointObjectTypeId,
  type ModelObject,
} from "#/runtime/model/definition/model.ts"
import type {
  ObjectBatchDeleteInput,
  ObjectBatchGetInput,
  ObjectDeleteInput,
  ObjectGetInput,
  ObjectRecord,
  ObjectType,
} from "#/runtime/model/definition/object.ts"
import type { Query } from "#/runtime/model/definition/query.ts"
import type {
  Batch,
  ListRequest,
  Page,
} from "#/runtime/model/definition/request.ts"
import type {
  InferInputSchema,
  InferSchema,
} from "#/runtime/model/definition/schema.ts"
import type {
  LinkListInput,
  LinkMutationInput,
} from "#/runtime/model/link-input.ts"

type CustomOperation = Action | Query
export type CustomOperations<M extends ModelCatalog> = Extract<
  M["actions"][keyof M["actions"]] | M["queries"][keyof M["queries"]],
  CustomOperation
>
type InputOf<T extends CustomOperation> = InferInputSchema<T["input"]>
type OutputOf<T extends CustomOperation> = InferSchema<T["output"]>

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
  readonly side: LinkTraversal
  readonly target: infer TTarget extends LinkTraversal
}
  ? {
      readonly list: DirectClientMethod<
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
    } & (TLink["outputOnly"] extends true
      ? {}
      : {
          readonly link: DirectClientMethod<LinkMutationInput, void>
          readonly unlink: DirectClientMethod<LinkMutationInput, void>
        })
  : never

type ObjectLinkClient<
  TModel extends ModelCatalog,
  TObject extends ObjectType,
> = {
  readonly [
    TSide in ClientLinkSides<TModel, TObject> as TSide["side"]["key"]
  ]: LinkTraversalClient<TModel, TSide>
}

export type ModelClientError =
  | ApiError
  | HttpClientError.HttpClientError
  | Schema.SchemaError

type DirectClientMethod<TInput, TOutput> = (
  input: TInput
) => Effect.Effect<TOutput, ModelClientError>

type CustomClient<Operations extends CustomOperation> = {
  readonly [O in Operations as O["id"]]: DirectClientMethod<
    InputOf<O>,
    OutputOf<O>
  >
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
  CustomClient<
    Extract<CustomOperations<TModel>, { readonly objectType: TObject["id"] }>
  > &
  ObjectLinkClient<TModel, TObject>

/** One noun-oriented model client generated from the native Effect contract. */
export type ModelClient<TModel extends ModelCatalog> = {
  readonly [TObject in ModelObject<TModel> as TObject["id"]]: ModelObjectClient<
    TModel,
    TObject
  >
} & CustomClient<
  Extract<CustomOperations<TModel>, { readonly objectType: undefined }>
>

type NativeModelMethod = (request: unknown) => Effect.Effect<unknown, unknown>

function nativeGroup(nativeClient: object, id: string): object {
  const group = Reflect.get(nativeClient, id)
  if (typeof group !== "object" || group === null) {
    throw new Error(`HTTP client group '${id}' is missing.`)
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

/**
 * Projects Effect's generated HttpApiClient for an application contract as direct
 * object, Action, and Link methods. Both sides are generated from the same model, so
 * the native client is addressed by endpoint id rather than typed a second time.
 */
export function createModelClient<TModel extends ModelCatalog>(
  model: TModel,
  nativeClient: object
): ModelClient<TModel> {
  const result: Record<string, unknown> = {}
  for (const object of modelObjects(model)) result[object.id] = {}
  for (const operation of modelOperations(model)) {
    const http = httpOperation(operation)
    const method = nativeMethod(
      nativeGroup(nativeClient, http.group),
      http.identifier
    )
    const call = (input: Readonly<Record<string, unknown>> = {}) =>
      method(httpOperationRequest(http, input))
    if (operation.object === undefined) {
      result[operation.id] = call
      continue
    }
    const methods = result[operation.object.id]
    if (typeof methods !== "object" || methods === null)
      throw new Error(`Missing object client '${operation.object.id}'.`)
    if (operation.linkTraversal === undefined)
      Reflect.set(methods, operation.id, call)
    else {
      const key = operation.linkTraversal.traversal.key
      const existing = Reflect.get(methods, key)
      const traversal =
        typeof existing === "object" && existing !== null ? existing : {}
      Object.assign(traversal, { [operation.id]: call })
      Reflect.set(methods, key, traversal)
    }
  }
  // SAFETY: methods and traversal groups are exhaustively generated from the
  // same model and checked against its native Effect client above.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return result as ModelClient<TModel>
}
