import { Schema } from "effect"

import { calendarDay } from "#/runtime/ui/model/collection-dates.ts"
import { CollectionFilterValueSchema } from "#/runtime/ui/model/collection-filter.ts"
import { CollectionLayoutSchema } from "#/runtime/ui/model/collection-layout.ts"
import type {
  ObjectCollectionSearch,
  ObjectCollectionView,
  ObjectCollectionViewState,
} from "#/runtime/ui/model/collection-view.ts"

interface ResolvedObjectCollectionView {
  readonly state: ObjectCollectionViewState
  readonly view: ObjectCollectionView
}

export const emptyObjectCollectionViewState: ObjectCollectionViewState = {
  filters: [],
  sorting: [],
}

const ObjectCollectionViewStateSchema = Schema.Struct({
  query: Schema.optionalKey(Schema.String.check(Schema.isMaxLength(200))),
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
      value: CollectionFilterValueSchema,
    })
  ),
  sorting: Schema.Array(
    Schema.Struct({ desc: Schema.Boolean, id: Schema.String })
  ),
  columns: Schema.optionalKey(Schema.Array(Schema.String)),
})

const ObjectCollectionSearchSchema = Schema.Struct({
  tab: Schema.optional(Schema.Literal("controllers")),
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
