import {
  schema,
  type ListRequest,
  type PropertyDefinition,
} from "@company/runtime"
import type { ColumnFiltersState, SortingState } from "@tanstack/react-table"

import { modelObjectProperty, type ModelObject } from "./object-client"
import { objectTablePropertySchema } from "./object-table/object-table-cell-types"
import {
  readFilterValue,
  type ObjectTableFilterValue,
} from "./object-table/object-table-config"

type RuntimeFilter =
  | {
      readonly field: string
      readonly operator:
        | "contains"
        | "eq"
        | "gt"
        | "gte"
        | "in"
        | "isNull"
        | "lt"
        | "lte"
        | "startsWith"
      readonly value?: unknown
    }
  | { readonly and: ReadonlyArray<RuntimeFilter> }
  | { readonly not: RuntimeFilter }

interface CollectionSort {
  readonly direction: "asc" | "desc"
  readonly field: string
  readonly nulls: "last"
}

interface CollectionListRequest {
  filter?: RuntimeFilter
  pageSize: number
  pageToken?: ListRequest["pageToken"]
  sort?: ReadonlyArray<CollectionSort>
}

function objectProperty(
  object: ModelObject,
  propertyId: string
): PropertyDefinition | undefined {
  if (propertyId !== "parent") return modelObjectProperty(object, propertyId)
  if (object.parent.kind === "root") return undefined
  return {
    ...schema.recordId(
      { id: object.parent.typeId },
      { label: "Parent", immutable: true }
    ),
    immutable: true,
    nullable: false,
    outputOnly: false,
    requiredOnCreate: true,
  }
}

export function canFilterProperty(property: PropertyDefinition): boolean {
  const resolved = objectTablePropertySchema(property)
  return (
    resolved.kind === "boolean" ||
    resolved.kind === "decimal" ||
    resolved.kind === "enum" ||
    resolved.kind === "number" ||
    resolved.kind === "recordId" ||
    resolved.kind === "string"
  )
}

export function canSortProperty(property: PropertyDefinition): boolean {
  return canFilterProperty(property)
}

function filterScalar(
  property: PropertyDefinition,
  value: string
): boolean | number | string {
  const resolved = objectTablePropertySchema(property)
  if (resolved.kind === "boolean") return value === "true"
  if (resolved.kind === "number") return Number(value)
  return value
}

function equalityFilter(
  field: string,
  property: PropertyDefinition,
  values: ReadonlyArray<string>
): RuntimeFilter {
  const parsed = values.map((value) => filterScalar(property, value))
  return parsed.length === 1
    ? { field, operator: "eq", value: parsed[0]! }
    : { field, operator: "in", value: parsed }
}

function propertyFilter(
  field: string,
  property: PropertyDefinition,
  filter: ObjectTableFilterValue
): RuntimeFilter | undefined {
  if (filter.operator === "empty" || filter.operator === "notEmpty") {
    if (!property.nullable) return undefined
    const isNull: RuntimeFilter = { field, operator: "isNull" }
    return filter.operator === "empty" ? isNull : { not: isNull }
  }

  if (filter.values.length === 0) return undefined
  const equality = equalityFilter(field, property, filter.values)
  if (filter.operator === "equals") return equality
  if (filter.operator === "notEquals") return { not: equality }

  const value = filterScalar(property, filter.values[0]!)
  switch (filter.operator) {
    case "contains":
      return { field, operator: "contains", value: String(value) }
    case "doesNotContain":
      return {
        not: { field, operator: "contains", value: String(value) },
      }
    case "startsWith":
      return { field, operator: "startsWith", value: String(value) }
    case "greaterThan":
    case "after":
      return { field, operator: "gt", value }
    case "atLeast":
    case "onOrAfter":
      return { field, operator: "gte", value }
    case "lessThan":
    case "before":
      return { field, operator: "lt", value }
    case "atMost":
    case "onOrBefore":
      return { field, operator: "lte", value }
    default:
      return undefined
  }
}

export function objectListRequest(
  object: ModelObject,
  columnFilters: ColumnFiltersState,
  sorting: SortingState,
  pageToken?: ListRequest["pageToken"]
): ListRequest {
  const filters = columnFilters.flatMap((columnFilter) => {
    const property = objectProperty(object, columnFilter.id)
    if (property === undefined || !canFilterProperty(property)) return []
    const filter = propertyFilter(
      columnFilter.id,
      property,
      readFilterValue(columnFilter.value)
    )
    return filter === undefined ? [] : [filter]
  })
  const sort = sorting.flatMap((columnSort) => {
    const property = objectProperty(object, columnSort.id)
    if (property === undefined || !canSortProperty(property)) return []
    return [
      {
        direction: columnSort.desc ? "desc" : "asc",
        field: columnSort.id,
        nulls: "last",
      } satisfies CollectionSort,
    ]
  })

  const request: CollectionListRequest = { pageSize: 50 }
  if (filters.length > 0) {
    request.filter = filters.length === 1 ? filters[0]! : { and: filters }
  }
  if (pageToken !== undefined) request.pageToken = pageToken
  if (sort.length > 0) request.sort = sort
  // SAFETY: filters and sorts are constructed only from fields and operators
  // supported by the closed object's portable ListRequest contract.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return request as ListRequest
}
