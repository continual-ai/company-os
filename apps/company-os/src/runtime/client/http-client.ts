import type { Effect, Schema } from "effect"
import type { HttpClientError } from "effect/unstable/http"

import type {
  PolymorphicReads,
  RecordReads,
  LinkReads,
} from "#/runtime/client/read-types.ts"
import {
  httpOperation,
  httpOperationRequest,
} from "#/runtime/contract/http-operation.ts"
import {
  operationContracts,
  projectOperations,
  type OperationContract,
} from "#/runtime/contract/operation-contract.ts"
import type {
  RecordSearchInput,
  RecordSearchOutput,
} from "#/runtime/contract/record-search.ts"
import { type Action } from "#/runtime/model/definition/action.ts"
import type { ApiError } from "#/runtime/model/definition/error.ts"
import type { ModelRecordSides } from "#/runtime/model/definition/model-record.ts"
import {
  type ModelCatalog,
  type ModelObject,
} from "#/runtime/model/definition/model.ts"
import type {
  ObjectCreateInput,
  ObjectUpdateInput,
  ObjectRecord,
  ObjectBatchDeleteInput,
  ObjectDeleteInput,
  ObjectType,
} from "#/runtime/model/definition/object.ts"
import type { Query } from "#/runtime/model/definition/query.ts"
import type {
  InferInputSchema,
  InferSchema,
} from "#/runtime/model/definition/schema.ts"
import type { LinkMutationInput } from "#/runtime/model/link-input.ts"

type CustomOperation = Action | Query
export type CustomOperations<M extends ModelCatalog> = Extract<
  M["actions"][keyof M["actions"]] | M["queries"][keyof M["queries"]],
  CustomOperation
>
type InputOf<T extends CustomOperation> = InferInputSchema<T["input"]>
type OutputOf<T extends CustomOperation> = InferSchema<T["output"]>

type ObjectLinkClient<M extends ModelCatalog, O extends ObjectType> = LinkReads<
  M,
  O,
  "effect"
> & {
  readonly [
    S in ModelRecordSides<M, O> as S["side"]["key"]
  ]: S["side"]["max"] extends 1
    ? {}
    : S["link"]["outputOnly"] extends true
      ? {}
      : {
          readonly link: DirectClientMethod<LinkMutationInput, void>
          readonly unlink: DirectClientMethod<LinkMutationInput, void>
        }
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

type ModelObjectClient<
  TModel extends ModelCatalog,
  TObject extends ModelObject<TModel>,
> = RecordReads<TModel, TObject, "effect"> &
  ("batchDelete" extends keyof TObject["actions"]
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
          ObjectCreateInput<TObject, TModel>,
          ObjectRecord<TObject, TModel>
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
          ObjectUpdateInput<TObject, TModel>,
          ObjectRecord<TObject, TModel>
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
> & {
    readonly records: PolymorphicReads<TModel, "effect"> & {
      readonly search: DirectClientMethod<RecordSearchInput, RecordSearchOutput>
    }
  }

type NativeModelMethod = (request: unknown) => Effect.Effect<unknown, unknown>

function nativeGroup(nativeClient: object, id: string): object {
  const group = Reflect.get(nativeClient, id)
  if (typeof group !== "object" || group === null) {
    throw new Error(`Client group '${id}' is missing.`)
  }
  return group
}

function nativeMethod(group: object, identifier: string): NativeModelMethod {
  const method = Reflect.get(group, identifier)
  if (typeof method !== "function") {
    throw new Error(`Client operation '${identifier}' is missing.`)
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
  const result = projectOperations(operationContracts(model), (operation) => {
    const http = httpOperation(operation)
    const method = nativeMethod(
      nativeGroup(nativeClient, http.group),
      http.identifier
    )
    return (input: Readonly<Record<string, unknown>> = {}) =>
      method(httpOperationRequest(http, input))
  })
  // SAFETY: methods and traversal groups are exhaustively generated from the
  // same model and checked against its native Effect client above.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return result as ModelClient<TModel>
}

/** Map the known operation inventory without recursively interpreting client objects. */
export function mapModelClient(
  model: ModelCatalog,
  client: object,
  project: (contract: OperationContract, invoke: NativeModelMethod) => unknown
): Record<string, unknown> {
  return projectOperations(operationContracts(model), (contract) => {
    const path = contract.key.split(".")
    let group = client
    for (const key of path.slice(0, -1)) group = nativeGroup(group, key)
    return project(contract, nativeMethod(group, contract.id))
  })
}
