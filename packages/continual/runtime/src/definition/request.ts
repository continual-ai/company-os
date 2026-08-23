import { Brand } from "effect"

import type { ObjectRecord, ObjectType } from "./object"
import type { InferProperty, PropertyDefinition } from "./property"
import type { InferInputSchema, RecordIdentifier } from "./schema"

export const DEFAULT_PAGE_SIZE = 50 as const
export const MAX_PAGE_SIZE = 100 as const
export const MAX_BATCH_GET_SIZE = 100 as const
export const MAX_BATCH_DELETE_SIZE = 100 as const

export const filterOperators = [
  "contains",
  "endsWith",
  "eq",
  "gt",
  "gte",
  "in",
  "isNull",
  "lt",
  "lte",
  "startsWith",
] as const

export type FilterOperator = (typeof filterOperators)[number]

export const sortDirections = ["asc", "desc"] as const
export type SortDirection = (typeof sortDirections)[number]

export const nullPlacements = ["first", "last"] as const
export type NullPlacement = (typeof nullPlacements)[number]

/** Opaque token returned by one list call and supplied to the next. */
export type PageToken = string & Brand.Brand<"PageToken">
export const PageToken = Brand.make<PageToken>(
  (value) => value.length > 0 || "Expected a non-empty page token"
)

/** Client-generated key retained across retries of the same mutation. */
export type IdempotencyKey = string & Brand.Brand<"IdempotencyKey">
export const IdempotencyKey = Brand.make<IdempotencyKey>(
  (value) => value.length > 0 || "Expected a non-empty idempotency key"
)

type EqualityFilter<TField extends string, TValue> =
  | {
      readonly field: TField
      readonly operator: "eq"
      readonly value: TValue
    }
  | {
      readonly field: TField
      readonly operator: "in"
      readonly value: ReadonlyArray<TValue>
    }

type OrderedFilter<TField extends string, TValue> =
  | EqualityFilter<TField, TValue>
  | {
      readonly field: TField
      readonly operator: "gt" | "gte" | "lt" | "lte"
      readonly value: TValue
    }

type TextFilter<TField extends string, TValue> =
  | EqualityFilter<TField, TValue>
  | {
      readonly field: TField
      readonly operator: "contains" | "endsWith" | "startsWith"
      readonly value: string
    }

type NullableFilter<
  TField extends string,
  TProperty extends PropertyDefinition,
> = TProperty["nullable"] extends true
  ? {
      readonly field: TField
      readonly operator: "isNull"
    }
  : never

type PropertyFilter<
  TField extends string,
  TProperty extends PropertyDefinition,
  TAcceptAliases extends boolean,
> =
  | NullableFilter<TField, TProperty>
  | (TProperty extends { readonly kind: "boolean" | "enum" | "recordId" }
      ? EqualityFilter<
          TField,
          Exclude<
            TProperty extends { readonly kind: "recordId" }
              ? TAcceptAliases extends true
                ? InferInputSchema<TProperty>
                : InferProperty<TProperty>
              : InferProperty<TProperty>,
            null
          >
        >
      : TProperty extends { readonly kind: "decimal" | "number" }
        ? OrderedFilter<TField, Exclude<InferProperty<TProperty>, null>>
        : TProperty extends {
              readonly format: "date" | "timestamp"
              readonly kind: "string"
            }
          ? OrderedFilter<TField, Exclude<InferProperty<TProperty>, null>>
          : TProperty extends { readonly kind: "string" }
            ? TextFilter<TField, Exclude<InferProperty<TProperty>, null>>
            : never)

type ObjectPropertyFilter<TObject extends ObjectType> = {
  [TField in keyof TObject["properties"] & string]: PropertyFilter<
    TField,
    TObject["properties"][TField],
    true
  >
}[keyof TObject["properties"] & string]

type CanonicalObjectPropertyFilter<TObject extends ObjectType> = {
  [TField in keyof TObject["properties"] & string]: PropertyFilter<
    TField,
    TObject["properties"][TField],
    false
  >
}[keyof TObject["properties"] & string]

type BaseObjectFilter<TObject extends ObjectType> =
  | EqualityFilter<"createdById" | "updatedById", string>
  | EqualityFilter<"id", RecordIdentifier<TObject["id"]>>
  | EqualityFilter<
      "parentId",
      RecordIdentifier<TObject["parent"]["objectType"]>
    >
  | OrderedFilter<"createdAt" | "updatedAt", ObjectRecord<TObject>["createdAt"]>

export type ObjectFilter<TObject extends ObjectType = ObjectType> =
  | BaseObjectFilter<TObject>
  | ObjectPropertyFilter<TObject>
  | {
      readonly and: ReadonlyArray<ObjectFilter<TObject>>
    }
  | {
      readonly not: ObjectFilter<TObject>
    }
  | {
      readonly or: ReadonlyArray<ObjectFilter<TObject>>
    }

type CanonicalBaseObjectFilter<TObject extends ObjectType> =
  | EqualityFilter<"createdById" | "updatedById", string>
  | EqualityFilter<"id", ObjectRecord<TObject>["id"]>
  | EqualityFilter<"parentId", ObjectRecord<TObject>["parentId"]>
  | OrderedFilter<"createdAt" | "updatedAt", ObjectRecord<TObject>["createdAt"]>

export type CanonicalObjectFilter<TObject extends ObjectType> =
  | CanonicalBaseObjectFilter<TObject>
  | CanonicalObjectPropertyFilter<TObject>
  | { readonly and: ReadonlyArray<CanonicalObjectFilter<TObject>> }
  | { readonly not: CanonicalObjectFilter<TObject> }
  | { readonly or: ReadonlyArray<CanonicalObjectFilter<TObject>> }

type SortablePropertyKeys<TObject extends ObjectType> = {
  [
    TField in keyof TObject["properties"] & string
  ]: TObject["properties"][TField] extends {
    readonly kind:
      | "boolean"
      | "decimal"
      | "enum"
      | "number"
      | "recordId"
      | "string"
  }
    ? TField
    : never
}[keyof TObject["properties"] & string]

export interface ObjectSort<TObject extends ObjectType = ObjectType> {
  readonly direction: SortDirection
  readonly field:
    | "createdAt"
    | "createdById"
    | "id"
    | "parentId"
    | "updatedAt"
    | "updatedById"
    | SortablePropertyKeys<TObject>
  /** Defaults to `last`, independently of direction. */
  readonly nulls?: NullPlacement
}

export interface ListRequest<TObject extends ObjectType = ObjectType> {
  readonly filter?: ObjectFilter<TObject>
  readonly pageSize?: number
  readonly pageToken?: PageToken
  readonly sort?: ReadonlyArray<ObjectSort<TObject>>
}

export interface CanonicalListRequest<TObject extends ObjectType> {
  readonly filter?: CanonicalObjectFilter<TObject>
  readonly pageSize?: number
  readonly pageToken?: PageToken
  readonly sort?: ReadonlyArray<ObjectSort<TObject>>
}

export interface Page<TItem> {
  readonly items: ReadonlyArray<TItem>
  /** Empty when there is no next page. */
  readonly nextPageToken: PageToken | ""
}

export interface Batch<TItem> {
  readonly items: ReadonlyArray<TItem>
}

export interface MutationOptions {
  readonly idempotencyKey?: IdempotencyKey
}
