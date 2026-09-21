import {
  columnFilteringFeature,
  columnPinningFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  constructFilterFn,
  constructSortFn,
  createFilteredRowModel,
  createSortedRowModel,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  tableFeatures,
  type ReactTable,
} from "@tanstack/react-table"

import type { ModelLinkTraversal } from "#/runtime/model/definition/model.ts"
import type { ImageRef, PropertyDefinition } from "#/runtime/model/index.ts"
import type {
  ObjectTableFilterOperator,
  ObjectTableFilterValue,
} from "#/runtime/ui/model/collection-view.ts"
import type {
  ClientRecord,
  ClientValue,
  ObjectRecordPresentation,
} from "#/runtime/ui/model/object-client.ts"
import { objectTableCellBehavior } from "#/runtime/ui/model/object-table/object-table-cell-types.ts"

export type ObjectTableValue = ClientValue
export type ObjectTableRecord = Pick<ClientRecord, "id" | "links"> &
  Record<string, ClientValue | undefined>

export type ObjectTableImageResolver = (
  image: ImageRef
) => string | null | undefined

export type ObjectTableRecordResolver = (
  recordId: string
) => ObjectRecordPresentation | undefined

export function objectTableImageValue(
  value: ObjectTableValue | undefined
): ImageRef | null {
  if (value === null || value === undefined) return null
  return typeof value === "object" &&
    "assetId" in value &&
    typeof value.assetId === "string"
    ? {
        assetId: value.assetId,
        ...("alt" in value && typeof value.alt === "string"
          ? { alt: value.alt }
          : {}),
      }
    : null
}

export function objectTableValueText(
  value: ObjectTableValue | undefined
): string {
  if (value === null || value === undefined) return ""
  if (Array.isArray(value)) return value.map(objectTableValueText).join(", ")
  const image = objectTableImageValue(value)
  if (image !== null) return image.assetId
  if (typeof value === "object") {
    if (
      "amount" in value &&
      "currency" in value &&
      typeof value.amount === "string" &&
      typeof value.currency === "string"
    )
      return `${value.amount} ${value.currency}`
    return JSON.stringify(value)
  }

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

export function objectTableSortText(
  value: ObjectTableValue | undefined
): string {
  if (value === true) return "1"
  if (value === false) return "0"

  return objectTableValueText(value).trim().toLowerCase()
}

export interface ObjectTableColumnMeta {
  link?: ModelLinkTraversal

  editable?: boolean

  countLink?: string
  linkLabel?: string
  displayProperty?: PropertyDefinition
  essential?: boolean
  label: string
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
function isFilterValue(value: unknown): value is ObjectTableFilterValue {
  if (
    typeof value !== "object" ||
    value === null ||
    !("operator" in value) ||
    !("values" in value)
  ) {
    return false
  }

  return (
    (!("quantifier" in value) ||
      value.quantifier === "some" ||
      value.quantifier === "none" ||
      value.quantifier === "every") &&
    typeof value.operator === "string" &&
    value.operator in operatorLabels &&
    Array.isArray(value.values) &&
    value.values.every((filterValue) => typeof filterValue === "string")
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
  autoRemove: (value: unknown) => !isFilterValue(value),
  // TanStack owns the filter-value extension point; it is parsed here.
  filter: (dataValue: ObjectTableValue, filterValue: unknown) => {
    if (!isFilterValue(filterValue)) return true

    return matchesObjectTableFilter(dataValue, filterValue)
  },
})

const objectPropertySort = constructSortFn({
  ...sortFn_alphanumeric,
  resolveDataValue: objectTableSortText,
})

const defaultColumnMeta: ObjectTableColumnMeta = { label: "" }

export const objectTableFeatures = tableFeatures({
  columnMeta: defaultColumnMeta,
  columnFilteringFeature,
  filterFns: { objectProperty: objectPropertyFilter },
  filteredRowModel: createFilteredRowModel(),
  columnSizingFeature,
  columnPinningFeature,
  columnResizingFeature,
  columnVisibilityFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFns: { objectProperty: objectPropertySort },
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
  const emptyOperators: ReadonlyArray<ObjectTableFilterOperator> =
    property.nullable ? ["empty", "notEmpty"] : []

  if (filterFamily === "boolean") {
    return ["equals", "notEquals", ...emptyOperators]
  }
  if (filterFamily === "number") {
    return [
      "equals",
      "notEquals",
      "greaterThan",
      "atLeast",
      "lessThan",
      "atMost",
      ...emptyOperators,
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
      ...emptyOperators,
    ]
  }
  if (filterFamily === "recordId") {
    return ["equals", "notEquals", ...emptyOperators]
  }
  return [
    "contains",
    "doesNotContain",
    "startsWith",
    "equals",
    "notEquals",
    ...emptyOperators,
  ]
}

export function defaultFilterOperator(
  property: PropertyDefinition
): ObjectTableFilterOperator {
  const filterFamily = objectTableCellBehavior(property).filterFamily
  return filterFamily === "boolean" ||
    filterFamily === "number" ||
    filterFamily === "recordId"
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
export function readFilterValue(value: unknown): ObjectTableFilterValue {
  return isFilterValue(value) ? value : { operator: "contains", values: [] }
}
