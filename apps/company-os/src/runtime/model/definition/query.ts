import type { ObjectType } from "#/runtime/model/definition/object.ts"
import {
  defineOperationContract,
  type DefinedOperation,
  type OperationConstraints,
  type OperationDefinition,
} from "#/runtime/model/definition/operation.ts"
import type {
  InferInputSchema,
  InferSchema,
} from "#/runtime/model/definition/schema.ts"

export const standardQueryIds = ["get", "list", "batchGet"] as const
export type StandardQueryId = (typeof standardQueryIds)[number]
export type QueryDefinition = OperationDefinition
export type Query<D extends QueryDefinition = QueryDefinition> = Omit<
  DefinedOperation<D>,
  "kind"
> & { readonly kind: "query" }
export type QueryInput<Q extends Query> = InferInputSchema<Q["input"]>
export type QueryOutput<Q extends Query> = InferSchema<Q["output"]>
export function defineQuery<const D extends QueryDefinition>(
  definition: D & OperationConstraints<D>
): Query<D> {
  // SAFETY: the constructor preserves each literal field and validates record attachment.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return {
    ...defineOperationContract(definition),
    kind: "query",
    destructive: false,
    idempotent: true,
  } as Query<D>
}
export interface StandardQuery<
  TId extends string = string,
  TObjectType extends string = string,
  TScope extends "object" | "collection" = "object" | "collection",
> {
  readonly id: TId
  readonly objectType: TObjectType
  readonly scope: TScope
  readonly kind: "query"
  readonly name: string
  readonly description: string
}
export type StandardQueries<O extends ObjectType> = {
  readonly get: StandardQuery<"get", O["id"], "object">
  readonly list: StandardQuery<"list", O["id"], "collection">
  readonly batchGet: StandardQuery<"batchGet", O["id"], "collection">
}
export function queryKey(query: {
  readonly objectType: string | undefined
  readonly id: string
}): string {
  return query.objectType === undefined
    ? query.id
    : `${query.objectType}.${query.id}`
}

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
