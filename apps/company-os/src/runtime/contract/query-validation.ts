import { Schema } from "effect"

import { toEffectInputSchema } from "#/runtime/contract/schema.ts"
import type { ModelCatalog } from "#/runtime/model/definition/model.ts"
import type { AnySchema } from "#/runtime/model/definition/schema.ts"
import {
  fieldOperators,
  resolveQueryField,
} from "#/runtime/model/query-fields.ts"

/** Pattern operands describe a fragment; equality/range operands use the property's value schema. */
export function decodeQueryValue(
  property: AnySchema,
  operator: string,
  value: unknown
): boolean | number | string {
  const decoded: unknown = Schema.decodeUnknownSync(
    operator === "contains" ||
      operator === "startsWith" ||
      operator === "endsWith"
      ? Schema.String
      : toEffectInputSchema(property)
  )(value)
  if (
    typeof decoded !== "string" &&
    typeof decoded !== "number" &&
    typeof decoded !== "boolean"
  )
    throw new Error("A filter operand must be a non-null scalar value.")
  return decoded
}

type QueryType = Parameters<typeof resolveQueryField>[1]

/** Validate decoded expressions with the same field resolver used by SQL and collection controls. */
export function validateQuery(
  model: ModelCatalog,
  object: QueryType,
  input: {
    readonly pageOffset?: number
    readonly pageToken?: string
    readonly filter?: unknown
    readonly sort?: ReadonlyArray<{
      readonly field: string
      readonly aggregate?: "count" | "min" | "max"
    }>
  }
) {
  if (
    input.pageOffset !== undefined &&
    (!Number.isSafeInteger(input.pageOffset) ||
      input.pageOffset < 0 ||
      input.pageToken !== undefined)
  )
    throw new Error(
      "pageOffset must be a non-negative safe integer and cannot be combined with pageToken."
    )
  let nodes = 0
  const visit = (
    type: QueryType,
    value: unknown,
    depth = 0,
    hops = 0
  ): void => {
    if (++nodes > 100 || depth > 20)
      throw new Error("Filter exceeds the complexity limit.")
    if (!value || typeof value !== "object")
      throw new Error("Expected a filter expression.")
    if (
      "field" in value &&
      typeof value.field === "string" &&
      "operator" in value &&
      typeof value.operator === "string"
    ) {
      const { property, traversals } = resolveQueryField(
        model,
        type,
        value.field
      )
      if (hops + traversals.length > 3)
        throw new Error("Link paths may contain at most three traversals.")
      if (!fieldOperators(property).includes(value.operator))
        throw new Error(
          `Operator '${value.operator}' is not supported for '${value.field}'.`
        )
      if (value.operator !== "isNull") {
        if (!("value" in value))
          throw new Error(`Filter '${value.field}' requires a value.`)
        const operator = value.operator
        const decode = (item: unknown) =>
          decodeQueryValue(property, operator, item)
        if (value.operator === "in") {
          if (!Array.isArray(value.value))
            throw new Error("An in filter requires an array.")
          value.value.forEach((item: unknown) => decode(item))
        } else decode(value.value)
      }
      return
    }
    if ("link" in value && typeof value.link === "string") {
      const resolved = resolveQueryField(model, type, value.link, "count")
      if (hops >= 3)
        throw new Error("Link paths may contain at most three traversals.")
      for (const key of ["some", "none", "every"] as const) {
        if (key in value) {
          const nested: unknown = Reflect.get(value, key)
          if (
            nested &&
            typeof nested === "object" &&
            Object.keys(nested).length === 0
          )
            return
          visit(resolved.target, nested, depth + 1, hops + 1)
          return
        }
      }
      return
    }
    for (const key of ["and", "or"] as const)
      if (key in value) {
        const children: unknown = Reflect.get(value, key)
        if (!Array.isArray(children) || children.length === 0)
          throw new Error(`'${key}' requires at least one filter.`)
        for (const child of children) visit(type, child, depth + 1, hops)
        return
      }
    if ("not" in value) {
      visit(type, value.not, depth + 1, hops)
      return
    }
    throw new Error("Expected a filter expression.")
  }
  if (input.filter !== undefined) visit(object, input.filter)
  for (const sort of input.sort ?? [])
    resolveQueryField(model, object, sort.field, sort.aggregate)
}
