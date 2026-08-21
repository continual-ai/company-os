import type { PropertyDefinition } from "@continual/runtime"
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

export type ObjectTableValue =
  | boolean
  | null
  | number
  | ReadonlyArray<string>
  | string

export type ObjectTableRecord = { id: string } & Record<
  string,
  ObjectTableValue
>

export type ObjectTableFilterOperator =
  | "contains"
  | "empty"
  | "equals"
  | "notEmpty"
  | "notEquals"
  | "startsWith"

export interface ObjectTableFilterValue {
  operator: ObjectTableFilterOperator
  value: string
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
  contains: "contains",
  empty: "is empty",
  equals: "is",
  notEmpty: "is not empty",
  notEquals: "is not",
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
    !("value" in value)
  ) {
    return false
  }

  return (
    // oxlint-disable-next-line anti-slop/no-runtime-typeof
    typeof value.operator === "string" &&
    value.operator in operatorLabels &&
    // oxlint-disable-next-line anti-slop/no-runtime-typeof
    typeof value.value === "string"
  )
}

function normalizedText(value: ObjectTableValue): string {
  if (Array.isArray(value)) return value.join(" ").toLowerCase()
  if (value === null) return ""
  if (value === true) return "true"
  if (value === false) return "false"
  return value.toString().trim().toLowerCase()
}

const objectPropertyFilter = constructFilterFn({
  // TanStack owns this untyped extension point; the value is parsed here.
  // oxlint-disable-next-line anti-slop/no-unknown-parameters
  autoRemove: (value: unknown) => !isFilterValue(value),
  // TanStack owns the filter-value extension point; it is parsed here.
  // oxlint-disable-next-line anti-slop/no-unknown-parameters
  filter: (dataValue: ObjectTableValue, filterValue: unknown) => {
    if (!isFilterValue(filterValue)) return true

    const dataText = normalizedText(dataValue)
    const filterText = normalizedText(filterValue.value)

    switch (filterValue.operator) {
      case "contains":
        return filterText.length === 0 || dataText.includes(filterText)
      case "empty":
        return dataText.length === 0
      case "equals":
        return filterText.length === 0 || dataText === filterText
      case "notEmpty":
        return dataText.length > 0
      case "notEquals":
        return filterText.length === 0 || dataText !== filterText
      case "startsWith":
        return filterText.length === 0 || dataText.startsWith(filterText)
      default:
        return true
    }
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
  if (property.kind === "enum" || property.kind === "boolean") {
    return ["equals", "notEquals", "empty", "notEmpty"]
  }
  if (property.kind === "number" || property.kind === "recordId") {
    return ["equals", "notEquals", "empty", "notEmpty"]
  }
  return ["contains", "startsWith", "equals", "notEquals", "empty", "notEmpty"]
}

export function defaultFilterOperator(
  property: PropertyDefinition
): ObjectTableFilterOperator {
  return property.kind === "enum" || property.kind === "boolean"
    ? "equals"
    : "contains"
}

export function hasFilterInput(operator: ObjectTableFilterOperator): boolean {
  return operator !== "empty" && operator !== "notEmpty"
}

// TanStack Table exposes its generic column-filter value as unknown. This
// parser supplies a safe local default for invalid external values.
// oxlint-disable-next-line anti-slop/no-unknown-parameters
export function readFilterValue(value: unknown): ObjectTableFilterValue {
  return isFilterValue(value) ? value : { operator: "contains", value: "" }
}
