import {
  type ActionDefinition,
  type ActionDefinitions,
  type BoundActionSet,
  type Action,
  isStandardActionId,
} from "#/model/definition/action.ts"
import type {
  ObjectBatchGetInput,
  ObjectGetInput,
  ObjectRecord,
  ObjectType,
} from "#/model/definition/object.ts"
import { bindOperationContract } from "#/model/definition/operation-contract.ts"
import type { Batch, ListRequest, Page } from "#/model/definition/request.ts"
import type {
  InferInputSchema,
  InferSchema,
} from "#/model/definition/schema.ts"

export const standardQueryIds = ["get", "list", "batchGet"] as const

export type StandardQueryId = (typeof standardQueryIds)[number]
export type QueryScope = "collection" | "object"

/** Portable description of a read operation derived for every model object. */
export interface Query<
  TId extends string = string,
  TObjectType extends string = string,
  TScope extends QueryScope = QueryScope,
> {
  readonly description: string
  readonly id: TId
  readonly kind: "query"
  readonly name: string
  readonly objectType: TObjectType
  readonly scope: TScope
}

export type StandardQueries<TObject extends ObjectType> = {
  readonly batchGet: Query<"batchGet", TObject["id"], "collection">
  readonly get: Query<"get", TObject["id"], "object">
  readonly list: Query<"list", TObject["id"], "collection">
}

export type QueryInput<
  TObject extends ObjectType,
  TQuery extends StandardQueryId | keyof TObject["queries"],
> = TQuery extends "get"
  ? ObjectGetInput<TObject>
  : TQuery extends "list"
    ? ListRequest<TObject>
    : TQuery extends "batchGet"
      ? ObjectBatchGetInput<TObject>
      : TQuery extends keyof TObject["queries"]
        ? InferInputSchema<TObject["queries"][TQuery]["input"]>
        : never

export type QueryOutput<
  TObject extends ObjectType,
  TQuery extends StandardQueryId | keyof TObject["queries"],
> = TQuery extends "get"
  ? ObjectRecord<TObject>
  : TQuery extends "list"
    ? Page<ObjectRecord<TObject>>
    : TQuery extends "batchGet"
      ? Batch<ObjectRecord<TObject>>
      : TQuery extends keyof TObject["queries"]
        ? InferSchema<TObject["queries"][TQuery]["output"]>
        : never

export function standardQueries<TObject extends ObjectType>(
  object: TObject
): StandardQueries<TObject> {
  return {
    get: {
      description: `Gets a ${object.name.toLowerCase()} by ID or alias.`,
      id: "get",
      kind: "query",
      name: `Get ${object.name.toLowerCase()}`,
      objectType: object.id,
      scope: "object",
    },
    list: {
      description: `Lists ${object.pluralName.toLowerCase()} with filtering, sorting, and cursor pagination.`,
      id: "list",
      kind: "query",
      name: `List ${object.pluralName.toLowerCase()}`,
      objectType: object.id,
      scope: "collection",
    },
    batchGet: {
      description: `Returns ${object.pluralName.toLowerCase()} in the same order as the requested identifiers.`,
      id: "batchGet",
      kind: "query",
      name: `Batch get ${object.pluralName.toLowerCase()}`,
      objectType: object.id,
      scope: "collection",
    },
  }
}

export function queryKey(query: Query): string {
  return `${query.objectType}.${query.id}`
}

/** A custom read uses the same schema contract as an Action, with no mutation semantics. */
export type QueryDefinition = Omit<
  ActionDefinition,
  "destructive" | "idempotent"
>
export type QueryDefinitions = Readonly<Record<string, QueryDefinition>>
export type CustomQuery = Omit<
  Action,
  "kind" | "destructive" | "idempotent"
> & { readonly kind: "query" }
export type BoundQueries<
  TId extends string,
  TDefinitions extends ActionDefinitions,
> = {
  readonly [K in keyof BoundActionSet<TId, TDefinitions>["actions"]]: Omit<
    BoundActionSet<TId, TDefinitions>["actions"][K],
    "kind" | "destructive" | "idempotent"
  > & { readonly kind: "query" }
}
export function bindQueries<
  const TId extends string,
  const TDefinitions extends QueryDefinitions,
>(
  object: { readonly id: TId; readonly collection: string },
  definitions?: TDefinitions
): BoundQueries<TId, TDefinitions> {
  for (const id of Object.keys(definitions ?? {})) {
    if (standardQueryIds.some((standard) => standard === id))
      throw new Error(
        `Object '${object.id}' cannot redefine standard query '${id}'.`
      )
  }
  const queries: Record<string, CustomQuery> = {}
  for (const [id, definition] of Object.entries(definitions ?? {})) {
    if (isStandardActionId(id))
      throw new Error(
        `Query '${object.id}.${id}' conflicts with a standard Action.`
      )
    queries[id] = {
      ...bindOperationContract(object, id, definition),
      kind: "query",
    }
  }
  // SAFETY: each validated definition is bound under its own literal key.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return queries as BoundQueries<TId, TDefinitions>
}
