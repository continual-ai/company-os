import { Schema } from "effect"

import type {
  ObjectTableFilterOperator,
  ObjectTableFilterValue,
} from "./object-table/object-table-config"

export interface ObjectCollectionFilter {
  readonly id: string
  readonly value: ObjectTableFilterValue
}

export interface ObjectCollectionSort {
  readonly desc: boolean
  readonly id: string
}

export interface ObjectCollectionViewState {
  readonly filters: ReadonlyArray<ObjectCollectionFilter>
  readonly sorting: ReadonlyArray<ObjectCollectionSort>
  readonly visibility: Readonly<Record<string, boolean>>
}

export interface ObjectCollectionView {
  readonly id: string
  readonly label: string
  readonly state: ObjectCollectionViewState
}

export interface ObjectCollectionSearch {
  readonly state?: ObjectCollectionViewState | undefined
  readonly view?: string | undefined
}

interface ResolvedObjectCollectionView {
  readonly state: ObjectCollectionViewState
  readonly view: ObjectCollectionView
}

export const emptyObjectCollectionViewState: ObjectCollectionViewState = {
  filters: [],
  sorting: [],
  visibility: {},
}

const filterOperators = [
  "after",
  "atLeast",
  "atMost",
  "before",
  "contains",
  "doesNotContain",
  "empty",
  "equals",
  "greaterThan",
  "lessThan",
  "notEmpty",
  "notEquals",
  "onOrAfter",
  "onOrBefore",
  "startsWith",
] as const satisfies ReadonlyArray<ObjectTableFilterOperator>

const ObjectCollectionViewStateSchema = Schema.Struct({
  filters: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      value: Schema.Struct({
        operator: Schema.Literals(filterOperators),
        values: Schema.Array(Schema.String),
      }),
    })
  ),
  sorting: Schema.Array(
    Schema.Struct({ desc: Schema.Boolean, id: Schema.String })
  ),
  visibility: Schema.Record(Schema.String, Schema.Boolean),
})

const ObjectCollectionSearchSchema = Schema.Struct({
  state: Schema.optional(ObjectCollectionViewStateSchema),
  view: Schema.optional(Schema.String),
})

export const validateObjectCollectionSearch = Schema.decodeUnknownSync(
  ObjectCollectionSearchSchema
)

export function resolveObjectCollectionView(
  views: ReadonlyArray<ObjectCollectionView>,
  search: ObjectCollectionSearch
): ResolvedObjectCollectionView {
  const view = views.find(({ id }) => id === search.view) ?? views[0]
  if (view === undefined) {
    throw new Error("Object collections require at least one view.")
  }
  return { state: search.state ?? view.state, view }
}

export function objectCollectionStateSearch(
  view: ObjectCollectionView,
  state: ObjectCollectionViewState
): ObjectCollectionSearch {
  return state === view.state ? { view: view.id } : { state, view: view.id }
}
