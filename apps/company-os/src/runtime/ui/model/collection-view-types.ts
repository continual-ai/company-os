import type { ModelRecordSides } from "#/runtime/model/definition/model-record.ts"
import type { ModelCatalog, ObjectType } from "#/runtime/model/index.ts"
import type { PropertyFilterOperator } from "#/runtime/model/query-fields.ts"
import type { RecordPropertySchemas } from "#/runtime/model/record-properties.ts"
import type { FilterOperatorsFor } from "#/runtime/ui/model/collection-filter.ts"

type Queryable<P> = [PropertyFilterOperator<P>] extends [never] ? never : P
type Side<M extends ModelCatalog, O extends ObjectType> = ModelRecordSides<
  M,
  O
>["side"]
type Target<
  M extends ModelCatalog,
  Id extends string,
> = Id extends keyof M["objects"]
  ? M["objects"][Id]
  : Id extends keyof M["interfaces"]
    ? M["interfaces"][Id]
    : never

type RelatedSide<M extends ModelCatalog, S> = S extends {
  key: infer L extends string
  to: { typeId: infer Id extends string }
  max: infer Max
  min: infer Min
}
  ? {
      [K in keyof Target<M, Id>["properties"] & string]: Queryable<
        Target<M, Id>["properties"][K]
      > extends never
        ? never
        : {
            id: `${L}.${K}`
            schema: Max extends 1
              ? Min extends 0
                ? Omit<Target<M, Id>["properties"][K], "nullable"> & {
                    nullable: true
                  }
                : Target<M, Id>["properties"][K]
              : Target<M, Id>["properties"][K]
            plural: Max extends 1 ? false : true
          }
    }[keyof Target<M, Id>["properties"] & string]
  : never
type Count<S> = S extends { key: infer L extends string; max: infer Max }
  ? Max extends 1
    ? never
    : { id: `${L}.$count`; schema: { kind: "number" }; plural: false }
  : never

type Properties<O extends ObjectType> = O["properties"] & RecordPropertySchemas
type Fields<M extends ModelCatalog, O extends ObjectType> =
  | {
      [K in keyof Properties<O> & string]: {
        id: K
        schema: Properties<O>[K]
        plural: false
      }
    }[keyof Properties<O> & string]
  | RelatedSide<M, Side<M, O>>
  | Count<Side<M, O>>

type FieldId<F> = F extends { id: infer K extends string } ? K : never
export type ViewColumn<M extends ModelCatalog, O extends ObjectType> =
  | FieldId<Fields<M, O>>
  | Side<M, O>["key"]

type Values<P> = P extends {
  kind: "enum"
  values: ReadonlyArray<infer V extends string>
}
  ? V
  : P extends { kind: "boolean" }
    ? "true" | "false"
    : P extends { kind: "number" | "decimal" }
      ? `${number}`
      : string
type Filter<F> = F extends {
  id: infer K extends string
  schema: infer P
  plural: infer Plural
}
  ? K extends "aliases" | "metadata" | "etag" | "objectType"
    ? never
    : Queryable<P> extends never
      ? never
      : {
          readonly id: K
          readonly value: {
            readonly operator: FilterOperatorsFor<P>
            readonly values: ReadonlyArray<Values<P>>
            readonly quantifier?: Plural extends true
              ? "some" | "none" | "every"
              : never
          }
        }
  : never
export type ViewFilter<M extends ModelCatalog, O extends ObjectType> =
  | Filter<Fields<M, O>>
  | {
      readonly id: Side<M, O>["key"]
      readonly value: {
        readonly operator: "equals" | "notEquals" | "empty" | "notEmpty"
        readonly values: ReadonlyArray<string>
      }
    }
type Sortable<F> = F extends { schema: infer P }
  ? Queryable<P> extends never
    ? never
    : Exclude<
        F,
        | { plural: true }
        | { id: "aliases" | "metadata" | "etag" | "objectType" }
      >
  : never
export type ViewSort<M extends ModelCatalog, O extends ObjectType> = {
  readonly id: FieldId<Sortable<Fields<M, O>>>
  readonly desc: boolean
}

type PropertyKeys<O extends ObjectType, S> = {
  [K in keyof O["properties"] & string]: O["properties"][K] extends S
    ? K
    : never
}[keyof O["properties"] & string]
type DateKey<O extends ObjectType> = PropertyKeys<
  O,
  { kind: "string"; format: "date" | "timestamp" }
>
export type ViewLayout<O extends ObjectType> =
  | { readonly type: "table" | "feed" }
  | {
      readonly type: "kanban"
      readonly groupBy: PropertyKeys<O, { kind: "enum" }>
    }
  | {
      readonly type: "calendar"
      readonly start: DateKey<O>
      readonly end?: DateKey<O>
    }
  | {
      readonly type: "gantt"
      readonly start: DateKey<O>
      readonly end: DateKey<O>
    }
