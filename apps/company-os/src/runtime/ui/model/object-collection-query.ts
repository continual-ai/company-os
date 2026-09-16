import {
  modelObjectLinkTraversals,
  type ModelCatalog,
  type ListRequest,
  type PropertyDefinition,
} from "#/runtime/model/index.ts"
import {
  objectFields,
  requireObjectField,
} from "#/runtime/model/object-fields.ts"
import { queryProperty } from "#/runtime/model/query-fields.ts"
import { type CollectionDateWindow } from "#/runtime/ui/model/collection-dates.ts"
import type {
  ObjectCollectionFilter,
  ObjectCollectionSort,
  ObjectTableFilterValue,
} from "#/runtime/ui/model/collection-view.ts"
import type { ModelObject } from "#/runtime/ui/model/object-client.ts"
import { objectTablePropertySchema } from "#/runtime/ui/model/object-table/object-table-cell-types.ts"
import { readFilterValue } from "#/runtime/ui/model/object-table/object-table-config.ts"

type RuntimeFilter =
  | { readonly link: string; readonly some: RuntimeFilter }
  | { readonly link: string; readonly none: RuntimeFilter }
  | { readonly link: string; readonly every: RuntimeFilter }
  | { readonly link: string; readonly contains: string }
  | { readonly link: string; readonly isEmpty: true }
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
  | { readonly or: ReadonlyArray<RuntimeFilter> }
  | { readonly not: RuntimeFilter }

interface CollectionSort {
  readonly aggregate?: "count" | "min" | "max"
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

const boundary = (field: PropertyDefinition, value: string) =>
  field.kind === "string" && field.format === "timestamp"
    ? `${value}T00:00:00.000Z`
    : value

export function objectListRequest(
  object: ModelObject,
  columnFilters: ReadonlyArray<ObjectCollectionFilter>,
  sorting: ReadonlyArray<ObjectCollectionSort>,
  pageToken?: ListRequest["pageToken"],
  window?: CollectionDateWindow,
  model?: ModelCatalog,
  visibility?: Readonly<Record<string, boolean>>
): ListRequest {
  const fields = objectFields(object, model)
  const filters = columnFilters.flatMap((columnFilter) => {
    const field = requireObjectField(fields, columnFilter.id, "filter")
    const related = field.kind === "related" ? field.related : undefined
    if (related) {
      const value = readFilterValue(columnFilter.value)
      const filter = propertyFilter(
        related.count || related.traversal.traversal.max === 1
          ? related.id
          : related.key,
        related.property,
        value
      )
      return filter === undefined
        ? []
        : [
            related.count || related.traversal.traversal.max === 1
              ? filter
              : ({
                  link: related.traversal.traversal.key,
                  ...(value.quantifier === "none"
                    ? { none: filter }
                    : value.quantifier === "every"
                      ? { every: filter }
                      : { some: filter }),
                } satisfies RuntimeFilter),
          ]
    }
    if (field.kind === "link") {
      const { operator, values } = readFilterValue(columnFilter.value)
      if (operator === "empty")
        return [
          { link: columnFilter.id, isEmpty: true } satisfies RuntimeFilter,
        ]
      if (operator === "notEmpty")
        return [
          {
            not: { link: columnFilter.id, isEmpty: true },
          } satisfies RuntimeFilter,
        ]
      if (
        values.length === 0 ||
        (operator !== "equals" && operator !== "notEquals")
      )
        return []
      const matches: RuntimeFilter = {
        or: values.map((contains) => ({ link: columnFilter.id, contains })),
      }
      return [operator === "notEquals" ? { not: matches } : matches]
    }
    const filter = propertyFilter(
      columnFilter.id,
      field.property,
      readFilterValue(columnFilter.value)
    )
    return filter === undefined ? [] : [filter]
  })
  if (window !== undefined) {
    const start = queryProperty(object, window.startField)
    const end =
      window.endField === undefined
        ? undefined
        : queryProperty(object, window.endField)
    if (start?.kind === "string") {
      const inWindow: RuntimeFilter = {
        and: [
          {
            field: window.startField,
            operator: "gte",
            value: boundary(start, window.first),
          },
          {
            field: window.startField,
            operator: "lt",
            value: boundary(start, window.after),
          },
        ],
      }
      const alternatives: RuntimeFilter[] = [inWindow]
      if (start.nullable)
        alternatives.push({ field: window.startField, operator: "isNull" })
      if (end !== undefined && window.endField !== undefined)
        alternatives.push({
          and: [
            {
              field: window.startField,
              operator: "lt",
              value: boundary(start, window.first),
            },
            {
              field: window.endField,
              operator: "gte",
              value: boundary(end, window.first),
            },
          ],
        })
      filters.push({ or: alternatives })
    }
  }
  const sort = sorting.map((columnSort): CollectionSort => {
    const field = requireObjectField(fields, columnSort.id, "sort")
    const count = field.kind === "related" && field.related.count
    return {
      direction: columnSort.desc ? "desc" : "asc",
      field: count ? field.related.traversal.traversal.key : field.id,
      nulls: "last",
      ...(count ? { aggregate: "count" } : {}),
    }
  })

  const request: CollectionListRequest & {
    expand?: Readonly<Record<string, true>>
  } = { pageSize: 50 }
  if (model && visibility !== undefined) {
    const configured = Object.keys(visibility).length > 0
    request.expand = Object.fromEntries(
      modelObjectLinkTraversals(model, object)
        .filter(({ traversal }) =>
          configured
            ? Object.entries(visibility).some(
                ([key, visible]) =>
                  visible &&
                  (key === traversal.key ||
                    (key.startsWith(`${traversal.key}.`) &&
                      key !== `${traversal.key}.$count`))
              )
            : traversal.max === 1
        )
        .map(({ traversal }) => [traversal.key, true])
    )
  }
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
