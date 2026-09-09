import { Schema } from "effect"

import { calendarDay } from "#/runtime/ui/model/collection-dates.ts"
import { CollectionLayoutSchema } from "#/runtime/ui/model/collection-layout.ts"
import type {
  ObjectCollectionSearch,
  ObjectCollectionView,
  ObjectCollectionViewState,
} from "#/runtime/ui/model/collection-view.ts"
import type { ObjectTableFilterOperator } from "#/runtime/ui/model/collection-view.ts"

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
  layout: Schema.optionalKey(CollectionLayoutSchema),
  date: Schema.optionalKey(
    Schema.String.check(
      Schema.makeFilter(
        (value) => value.length === 10 && calendarDay(value) === value
      )
    )
  ),
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
