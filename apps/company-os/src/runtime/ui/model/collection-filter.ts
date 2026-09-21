import { Schema } from "effect"

import { decodeQueryValue } from "#/runtime/contract/query-validation.ts"
import type { AnySchema, PropertyDefinition } from "#/runtime/model/index.ts"
import {
  fieldOperators,
  type PropertyFilterOperator,
} from "#/runtime/model/query-fields.ts"

/** UI labels map to the model's query operators; they do not define query capabilities. */
const collectionFilterOperators = [
  { id: "equals", operator: "eq", label: "is" },
  { id: "notEquals", operator: "eq", label: "is not" },
  { id: "contains", operator: "contains", label: "contains" },
  { id: "doesNotContain", operator: "contains", label: "does not contain" },
  { id: "startsWith", operator: "startsWith", label: "starts with" },
  { id: "endsWith", operator: "endsWith", label: "ends with" },
  { id: "greaterThan", operator: "gt", label: "is greater than" },
  { id: "atLeast", operator: "gte", label: "is at least" },
  { id: "lessThan", operator: "lt", label: "is less than" },
  { id: "atMost", operator: "lte", label: "is at most" },
  { id: "after", operator: "gt", label: "is after" },
  { id: "onOrAfter", operator: "gte", label: "is on or after" },
  { id: "before", operator: "lt", label: "is before" },
  { id: "onOrBefore", operator: "lte", label: "is on or before" },
  { id: "empty", operator: "isNull", label: "is empty" },
  { id: "notEmpty", operator: "isNull", label: "is not empty" },
] as const

export type CollectionFilterOperator =
  (typeof collectionFilterOperators)[number]["id"]
type OperatorFor<P, D> = D extends { id: infer Id; operator: infer Op }
  ? Op extends PropertyFilterOperator<P>
    ? Id
    : never
  : never
export type FilterOperatorsFor<P> = Exclude<
  OperatorFor<P, (typeof collectionFilterOperators)[number]>,
  P extends { kind: "string"; format: "date" | "timestamp" }
    ? "greaterThan" | "atLeast" | "lessThan" | "atMost"
    : "after" | "onOrAfter" | "before" | "onOrBefore"
>

export const CollectionFilterValueSchema = Schema.Struct({
  quantifier: Schema.optionalKey(Schema.Literals(["some", "none", "every"])),
  operator: Schema.Literals(collectionFilterOperators.map(({ id }) => id)),
  values: Schema.Array(Schema.String),
})
export type CollectionFilterValue = typeof CollectionFilterValueSchema.Type
export const isFilterValue = Schema.is(CollectionFilterValueSchema)

/** TanStack's unknown filter values may be unfinished while a control is being edited. */
export function readFilterValue(value: unknown): CollectionFilterValue {
  return isFilterValue(value) ? value : { operator: "contains", values: [] }
}
export function filterOperator(operator: CollectionFilterOperator) {
  return collectionFilterOperators.find(({ id }) => id === operator)!
}
export function filterOperatorLabel(
  operator: CollectionFilterOperator
): string {
  return filterOperator(operator).label
}
export function filterOperatorsForProperty(
  property: AnySchema
): ReadonlyArray<CollectionFilterOperator> {
  const supported = fieldOperators(property)
  const date =
    property.kind === "string" &&
    (property.format === "date" || property.format === "timestamp")
  return collectionFilterOperators
    .filter(
      ({ id, operator }) =>
        supported.includes(operator) &&
        !(
          date
            ? ["greaterThan", "atLeast", "lessThan", "atMost"]
            : ["after", "onOrAfter", "before", "onOrBefore"]
        ).includes(id)
    )
    .map(({ id }) => id)
}
export function defaultFilterOperator(
  property: PropertyDefinition
): CollectionFilterOperator {
  return fieldOperators(property).includes("contains") ? "contains" : "equals"
}
export function filterInputType(
  property: PropertyDefinition
): "date" | "number" | "text" {
  if (
    property.kind === "string" &&
    (property.format === "date" || property.format === "timestamp")
  )
    return "date"
  return property.kind === "number" || property.kind === "decimal"
    ? "number"
    : "text"
}
export function hasFilterInput(operator: CollectionFilterOperator): boolean {
  return filterOperator(operator).operator !== "isNull"
}
export function isCompleteFilter(value: CollectionFilterValue): boolean {
  return !hasFilterInput(value.operator) || value.values.length > 0
}

export function decodeCollectionFilterValue(
  property: PropertyDefinition,
  operator: CollectionFilterOperator,
  input: string
): boolean | number | string {
  let value: boolean | number | string = input
  if (property.kind === "boolean") {
    if (input !== "true" && input !== "false")
      throw new Error("Expected true or false.")
    value = input === "true"
  } else if (property.kind === "number") {
    if (!input.trim()) throw new Error("Enter a number.")
    value = Number(input)
  }
  return decodeQueryValue(property, filterOperator(operator).operator, value)
}
