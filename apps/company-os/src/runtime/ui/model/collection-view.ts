import type { CollectionLayout } from "#/runtime/ui/model/collection-layout.ts"

export type ObjectTableFilterOperator =
  | "after"
  | "atLeast"
  | "atMost"
  | "before"
  | "contains"
  | "doesNotContain"
  | "empty"
  | "equals"
  | "greaterThan"
  | "lessThan"
  | "notEmpty"
  | "notEquals"
  | "onOrAfter"
  | "onOrBefore"
  | "startsWith"

export interface ObjectTableFilterValue {
  operator: ObjectTableFilterOperator
  values: ReadonlyArray<string>
}

export interface ObjectCollectionFilter {
  readonly id: string
  readonly value: ObjectTableFilterValue
}

export interface ObjectCollectionSort {
  readonly desc: boolean
  readonly id: string
}

export interface ObjectCollectionViewState {
  readonly layout?: CollectionLayout
  readonly date?: string
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

/** Defines a saved view with empty filters and sorting unless specified. */
export function defineCollectionView(
  id: string,
  label: string,
  options: {
    readonly layout?: CollectionLayout
    readonly columns: ReadonlyArray<string>
    readonly filters?: ObjectCollectionView["state"]["filters"]
    readonly sorting?: ObjectCollectionView["state"]["sorting"]
  }
): ObjectCollectionView {
  return {
    id,
    label,
    state: {
      ...(options.layout === undefined ? {} : { layout: options.layout }),
      filters: options.filters ?? [],
      sorting: options.sorting ?? [],
      visibility: Object.fromEntries(
        options.columns.map((column) => [column, true])
      ),
    },
  }
}
