import type { ImageRef, PropertyDefinition } from "@continual/runtime"
import {
  columnFilteringFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  constructFilterFn,
  createFilteredRowModel,
  createSortedRowModel,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  tableFeatures,
  type ReactTable,
} from "@tanstack/react-table"

import { objectTableCellBehavior } from "./object-table-cell-types"

export type ObjectTableValue =
  | boolean
  | ImageRef
  | null
  | number
  | ReadonlyArray<string>
  | string

export type ObjectTableRecord = { id: string } & Record<
  string,
  ObjectTableValue
>

export type ObjectTableImageResolver = (
  image: ImageRef
) => string | null | undefined

export function objectTableImageValue(
  value: ObjectTableValue | undefined
): ImageRef | null {
  if (value === null || value === undefined) return null
  // This is the parsed ObjectTableValue boundary; its only object member is ImageRef.
  // oxlint-disable-next-line anti-slop/no-runtime-typeof
  return typeof value === "object" && "assetId" in value ? value : null
}

export function objectTableValueText(
  value: ObjectTableValue | undefined
): string {
  if (value === null || value === undefined) return ""
  if (Array.isArray(value)) return value.join(", ")
  const image = objectTableImageValue(value)
  if (image !== null) return image.assetId

  // ObjectTableValue is already parsed; this exhausts its scalar members.
  // oxlint-disable-next-line anti-slop/no-runtime-typeof
  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false"
    case "number":
      return value.toString()
    case "string":
      return value
    default:
      return ""
  }
}

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

export interface ObjectTableColumnMeta {
  essential?: boolean
  label: string
  onCellCommit?:
    | ((
        recordId: string,
        propertyId: string,
        value: ObjectTableValue
      ) => Promise<void> | void)
    | undefined
  property?: PropertyDefinition
  propertyId?: string
}

const operatorLabels = {
  after: "is after",
  atLeast: "is at least",
  atMost: "is at most",
  before: "is before",
  contains: "contains",
  doesNotContain: "does not contain",
  empty: "is empty",
  equals: "is",
  greaterThan: "is greater than",
  lessThan: "is less than",
  notEmpty: "is not empty",
  notEquals: "is not",
  onOrAfter: "is on or after",
  onOrBefore: "is on or before",
  startsWith: "starts with",
} satisfies Record<ObjectTableFilterOperator, string>

// TanStack Table intentionally exposes filter values as unknown. This parser
// validates that boundary before the value enters the ObjectTable contract.
// oxlint-disable-next-line anti-slop/no-unknown-parameters
function isFilterValue(value: unknown): value is ObjectTableFilterValue {
  if (
    // oxlint-disable-next-line anti-slop/no-runtime-typeof
    typeof value !== "object" ||
    value === null ||
    !("operator" in value) ||
    !("values" in value)
  ) {
    return false
  }

  return (
    // oxlint-disable-next-line anti-slop/no-runtime-typeof
    typeof value.operator === "string" &&
    value.operator in operatorLabels &&
    Array.isArray(value.values) &&
    value.values.every(
      // oxlint-disable-next-line anti-slop/no-runtime-typeof
      (filterValue) => typeof filterValue === "string"
    )
  )
}

function normalizedText(value: ObjectTableValue): string {
  return objectTableValueText(value).trim().toLowerCase()
}

function isEmptyValue(value: ObjectTableValue): boolean {
  return (
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  )
}

export function matchesObjectTableFilter(
  dataValue: ObjectTableValue,
  filterValue: ObjectTableFilterValue
): boolean {
  if (filterValue.operator === "empty") return isEmptyValue(dataValue)
  if (filterValue.operator === "notEmpty") return !isEmptyValue(dataValue)

  const dataText = normalizedText(dataValue)
  const filterTexts = filterValue.values.map((value) => normalizedText(value))
  const firstFilterText = filterTexts[0] ?? ""

  if (filterTexts.length === 0 || firstFilterText.length === 0) return true

  switch (filterValue.operator) {
    case "contains":
      return dataText.includes(firstFilterText)
    case "doesNotContain":
      return !dataText.includes(firstFilterText)
    case "equals":
      return filterTexts.includes(dataText)
    case "notEquals":
      return !filterTexts.includes(dataText)
    case "startsWith":
      return dataText.startsWith(firstFilterText)
    case "greaterThan":
    case "atLeast":
    case "lessThan":
    case "atMost": {
      const dataNumber = Number(dataText)
      const filterNumber = Number(firstFilterText)
      if (!Number.isFinite(dataNumber) || !Number.isFinite(filterNumber)) {
        return false
      }
      if (filterValue.operator === "greaterThan") {
        return dataNumber > filterNumber
      }
      if (filterValue.operator === "atLeast") return dataNumber >= filterNumber
      if (filterValue.operator === "lessThan") return dataNumber < filterNumber
      return dataNumber <= filterNumber
    }
    case "after":
      return dataText > firstFilterText
    case "before":
      return dataText < firstFilterText
    case "onOrAfter":
      return dataText >= firstFilterText
    case "onOrBefore":
      return dataText <= firstFilterText
    default:
      return true
  }
}

const objectPropertyFilter = constructFilterFn({
  // TanStack owns this untyped extension point; the value is parsed here.
  // oxlint-disable-next-line anti-slop/no-unknown-parameters
  autoRemove: (value: unknown) => !isFilterValue(value),
  // TanStack owns the filter-value extension point; it is parsed here.
  // oxlint-disable-next-line anti-slop/no-unknown-parameters
  filter: (dataValue: ObjectTableValue, filterValue: unknown) => {
    if (!isFilterValue(filterValue)) return true

    return matchesObjectTableFilter(dataValue, filterValue)
  },
})

export const objectTableFeatures = tableFeatures({
  // SAFETY: every ObjectTable column creates metadata matching this local
  // contract before the definition is passed to TanStack Table.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  columnMeta: {} as ObjectTableColumnMeta,
  columnFilteringFeature,
  filterFns: { objectProperty: objectPropertyFilter },
  filteredRowModel: createFilteredRowModel(),
  columnSizingFeature,
  columnResizingFeature,
  columnVisibilityFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFns: { alphanumeric: sortFn_alphanumeric },
  sortedRowModel: createSortedRowModel(),
})

export type ObjectTableInstance = ReactTable<
  typeof objectTableFeatures,
  ObjectTableRecord
>

export function filterOperatorLabel(
  operator: ObjectTableFilterOperator
): string {
  return operatorLabels[operator]
}

export function filterOperatorsForProperty(
  property: PropertyDefinition
): ReadonlyArray<ObjectTableFilterOperator> {
  const filterFamily = objectTableCellBehavior(property).filterFamily

  if (filterFamily === "boolean") {
    return ["equals", "notEquals", "empty", "notEmpty"]
  }
  if (filterFamily === "number") {
    return [
      "equals",
      "notEquals",
      "greaterThan",
      "atLeast",
      "lessThan",
      "atMost",
      "empty",
      "notEmpty",
    ]
  }
  if (filterFamily === "date") {
    return [
      "equals",
      "notEquals",
      "before",
      "onOrBefore",
      "after",
      "onOrAfter",
      "empty",
      "notEmpty",
    ]
  }
  if (filterFamily === "recordId") {
    return ["equals", "notEquals", "empty", "notEmpty"]
  }
  return [
    "contains",
    "doesNotContain",
    "startsWith",
    "equals",
    "notEquals",
    "empty",
    "notEmpty",
  ]
}

export function defaultFilterOperator(
  property: PropertyDefinition
): ObjectTableFilterOperator {
  const filterFamily = objectTableCellBehavior(property).filterFamily
  return filterFamily === "boolean" || filterFamily === "number"
    ? "equals"
    : filterFamily === "date"
      ? "equals"
      : "contains"
}

export function filterInputType(
  property: PropertyDefinition
): "date" | "number" | "text" {
  const filterFamily = objectTableCellBehavior(property).filterFamily
  if (filterFamily === "date") return "date"
  if (filterFamily === "number") return "number"
  return "text"
}

export function hasFilterInput(operator: ObjectTableFilterOperator): boolean {
  return operator !== "empty" && operator !== "notEmpty"
}

// TanStack Table exposes its generic column-filter value as unknown. This
// parser supplies a safe local default for invalid external values.
// oxlint-disable-next-line anti-slop/no-unknown-parameters
export function readFilterValue(value: unknown): ObjectTableFilterValue {
  return isFilterValue(value) ? value : { operator: "contains", values: [] }
}
