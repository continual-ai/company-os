import type { ObjectType } from "#/runtime/model/definition/object.ts"
import {
  modelObjectLinkTraversals,
  type ModelCatalog,
  type ListRequest,
  type ObjectFilter,
  type PropertyDefinition,
} from "#/runtime/model/index.ts"
import {
  objectFields,
  requireObjectField,
} from "#/runtime/model/object-fields.ts"
import { queryProperty } from "#/runtime/model/query-fields.ts"
import { type CollectionDateWindow } from "#/runtime/ui/model/collection-dates.ts"
import {
  filterOperator,
  decodeCollectionFilterValue,
  filterOperatorsForProperty,
  type CollectionFilterValue,
} from "#/runtime/ui/model/collection-filter.ts"
import type {
  ObjectCollectionFilter,
  ObjectCollectionSort,
} from "#/runtime/ui/model/collection-view.ts"

function propertyFilter(
  field: string,
  property: PropertyDefinition,
  filter: CollectionFilterValue
): ObjectFilter | undefined {
  if (!filterOperatorsForProperty(property).includes(filter.operator))
    throw new Error(
      `Operator '${filter.operator}' is not supported for '${field}'.`
    )
  const operator = filterOperator(filter.operator).operator
  let expression: ObjectFilter
  if (operator === "isNull") {
    if (filter.values.length > 0)
      throw new Error(`Filter '${field}' does not accept values.`)
    expression = { field, operator }
  } else {
    // Incomplete input belongs only to the live filter controls; authored views reject it.
    if (filter.values.length === 0) return undefined
    if (operator !== "eq" && filter.values.length !== 1)
      throw new Error(`Filter '${field}' requires exactly one value.`)
    const values = filter.values.map((value) =>
      decodeCollectionFilterValue(property, filter.operator, value)
    )
    expression =
      operator === "eq" && values.length > 1
        ? { field, operator: "in", value: values }
        : { field, operator, value: values[0]! }
  }
  return ["notEquals", "doesNotContain", "notEmpty"].includes(filter.operator)
    ? { not: expression }
    : expression
}

const boundary = (field: PropertyDefinition, value: string) =>
  field.kind === "string" && field.format === "timestamp"
    ? `${value}T00:00:00.000Z`
    : value

export function objectListRequest(
  object: ObjectType,
  columnFilters: ReadonlyArray<ObjectCollectionFilter>,
  sorting: ReadonlyArray<ObjectCollectionSort>,
  pageToken?: ListRequest["pageToken"],
  window?: CollectionDateWindow,
  model?: ModelCatalog,
  columns?: ReadonlyArray<string>,
  query?: string
): ListRequest {
  const fields = objectFields(object, model)
  const filters = columnFilters.flatMap((columnFilter) => {
    const field = requireObjectField(fields, columnFilter.id, "filter")
    if (
      columnFilter.value.quantifier &&
      !(
        field.kind === "related" &&
        !field.related.count &&
        field.related.traversal.traversal.max !== 1
      )
    )
      throw new Error(`Filter '${field.id}' does not support a quantifier.`)
    const related = field.kind === "related" ? field.related : undefined
    if (related) {
      const value = columnFilter.value
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
                } satisfies ObjectFilter),
          ]
    }
    if (field.kind === "link") {
      const { operator, values } = columnFilter.value
      if (operator === "empty")
        return [{ link: columnFilter.id, isEmpty: true } satisfies ObjectFilter]
      if (operator === "notEmpty")
        return [
          {
            not: { link: columnFilter.id, isEmpty: true },
          } satisfies ObjectFilter,
        ]
      if (operator !== "equals" && operator !== "notEquals")
        throw new Error(
          `Operator '${operator}' is not supported for '${field.id}'.`
        )
      if (values.length === 0) return []
      const matches: ObjectFilter = {
        or: values.map((contains) => ({ link: columnFilter.id, contains })),
      }
      return [operator === "notEquals" ? { not: matches } : matches]
    }
    const filter = propertyFilter(
      columnFilter.id,
      field.property,
      columnFilter.value
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
      const inWindow: ObjectFilter = {
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
      const alternatives: ObjectFilter[] = [inWindow]
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
  const sort = sorting.map(
    (columnSort): NonNullable<ListRequest["sort"]>[number] => {
      const field = requireObjectField(fields, columnSort.id, "sort")
      const count = field.kind === "related" && field.related.count
      return {
        direction: columnSort.desc ? "desc" : "asc",
        field: count ? field.related.traversal.traversal.key : field.id,
        nulls: "last",
        ...(count ? { aggregate: "count" } : {}),
      }
    }
  )

  let expand: ListRequest["expand"]
  if (model && columns !== undefined) {
    expand = Object.fromEntries(
      modelObjectLinkTraversals(model, object)
        .filter(({ traversal }) =>
          columns.some(
            (key) =>
              key === traversal.key ||
              (key.startsWith(`${traversal.key}.`) &&
                key !== `${traversal.key}.$count`)
          )
        )
        .map(({ traversal }) => [traversal.key, true])
    )
  }
  return {
    pageSize: 100,
    ...(expand === undefined ? {} : { expand }),
    ...(query?.trim() ? { query: query.trim() } : {}),
    ...(filters.length > 0
      ? { filter: filters.length === 1 ? filters[0]! : { and: filters } }
      : {}),
    ...(pageToken === undefined ? {} : { pageToken }),
    ...(sort.length > 0 ? { sort } : {}),
  }
}
