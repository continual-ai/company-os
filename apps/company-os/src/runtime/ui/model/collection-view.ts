import { validateQuery } from "#/runtime/contract/query-validation.ts"
import type { ModelCatalog, ObjectType } from "#/runtime/model/index.ts"
import {
  objectFields,
  requireObjectField,
} from "#/runtime/model/object-fields.ts"
import {
  isCompleteFilter,
  type CollectionFilterValue,
} from "#/runtime/ui/model/collection-filter.ts"
import { collectionLayoutError } from "#/runtime/ui/model/collection-layout.ts"
import type { CollectionLayout } from "#/runtime/ui/model/collection-layout.ts"
import type {
  ViewColumn,
  ViewFilter,
  ViewSort,
  ViewLayout,
} from "#/runtime/ui/model/collection-view-types.ts"
import { objectListRequest } from "#/runtime/ui/model/object-collection-query.ts"

export interface ObjectCollectionFilter {
  readonly id: string
  readonly value: CollectionFilterValue
}

export interface ObjectCollectionSort {
  readonly desc: boolean
  readonly id: string
}

export interface ObjectCollectionViewState {
  readonly query?: string
  readonly layout?: CollectionLayout
  readonly date?: string
  readonly filters: ReadonlyArray<ObjectCollectionFilter>
  readonly sorting: ReadonlyArray<ObjectCollectionSort>
  readonly columns?: ReadonlyArray<string>
}

export interface ObjectCollectionView {
  readonly id: string
  readonly label: string
  readonly state: ObjectCollectionViewState
}

export interface ObjectCollectionSearch {
  readonly tab?: "controllers" | undefined
  readonly state?: ObjectCollectionViewState | undefined
  readonly view?: string | undefined
}

/** Defines a saved view with empty filters and sorting unless specified. */
export function defineCollectionView<
  M extends ModelCatalog,
  O extends ObjectType,
>(
  model: M,
  object: O,
  id: string,
  label: string,
  options: {
    readonly layout?: ViewLayout<NoInfer<O>>
    readonly columns: ReadonlyArray<ViewColumn<NoInfer<M>, NoInfer<O>>>
    readonly filters?: ReadonlyArray<ViewFilter<NoInfer<M>, NoInfer<O>>>
    readonly sorting?: ReadonlyArray<ViewSort<NoInfer<M>, NoInfer<O>>>
  }
): ObjectCollectionView {
  const fields = objectFields(object, model)
  for (const column of options.columns) requireObjectField(fields, column)
  for (const filter of options.filters ?? []) {
    requireObjectField(fields, filter.id, "filter")
    if (!isCompleteFilter(filter.value))
      throw new Error(`Filter '${filter.id}' requires a value.`)
  }
  for (const sort of options.sorting ?? [])
    requireObjectField(fields, sort.id, "sort")
  const error = collectionLayoutError(
    object,
    options.layout ?? { type: "table" }
  )
  if (error) throw new Error(`Invalid view '${object.id}.${id}': ${error}`)
  validateQuery(
    model,
    object,
    objectListRequest(
      object,
      options.filters ?? [],
      options.sorting ?? [],
      undefined,
      undefined,
      model
    )
  )
  return {
    id,
    label,
    state: {
      ...(options.layout === undefined ? {} : { layout: options.layout }),
      filters: options.filters ?? [],
      sorting: options.sorting ?? [],
      columns: options.columns,
    },
  }
}
