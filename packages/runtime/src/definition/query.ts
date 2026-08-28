import type {
  ObjectBatchGetInput,
  ObjectGetInput,
  ObjectRecord,
  ObjectType,
} from "./object"
import type { Batch, ListRequest, Page } from "./request"

export const standardQueryIds = ["get", "list", "batchGet"] as const

export type StandardQueryId = (typeof standardQueryIds)[number]
export type QueryScope = "collection" | "object"

/** Portable description of a read operation derived for every model object. */
export interface Query<
  TId extends StandardQueryId = StandardQueryId,
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
  TQuery extends StandardQueryId,
> = TQuery extends "get"
  ? ObjectGetInput<TObject>
  : TQuery extends "list"
    ? ListRequest<TObject>
    : ObjectBatchGetInput<TObject>

export type QueryOutput<
  TObject extends ObjectType,
  TQuery extends StandardQueryId,
> = TQuery extends "get"
  ? ObjectRecord<TObject>
  : TQuery extends "list"
    ? Page<ObjectRecord<TObject>>
    : Batch<ObjectRecord<TObject>>

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
