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
import type { ObjectField } from "#/runtime/model/object-fields.ts"
import type { CollectionFilterValue } from "#/runtime/ui/model/collection-filter.ts"
import { isFilterValue } from "#/runtime/ui/model/collection-filter.ts"
import type {
  ClientRecord,
  ClientValue,
  ObjectRecordPresentation,
} from "#/runtime/ui/model/object-client.ts"

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

  field?: ObjectField
  essential?: boolean
  label: string
  property?: PropertyDefinition
  propertyId?: string
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
  filterValue: CollectionFilterValue
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
    case "endsWith":
      return dataText.endsWith(firstFilterText)
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
