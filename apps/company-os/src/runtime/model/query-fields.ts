import type { LinkTraversal } from "#/runtime/model/definition/link.ts"
import {
  modelLinkTraversals,
  type ModelCatalog,
} from "#/runtime/model/definition/model.ts"
import {
  normalizeProperties,
  type PropertyDefinition,
} from "#/runtime/model/definition/property.ts"
import {
  schema,
  containsSecret,
  type AnySchema,
} from "#/runtime/model/definition/schema.ts"
import { recordProperties } from "#/runtime/model/record-properties.ts"

export interface QueryType {
  readonly id: string
  readonly properties: Readonly<Record<string, AnySchema>>
}

const normalized = new WeakMap<AnySchema, PropertyDefinition>()

export function queryProperty(
  object: { readonly properties: Readonly<Record<string, AnySchema>> },
  key: string
): PropertyDefinition | undefined {
  const value = object.properties[key]
  if (!value)
    return ["aliases", "metadata", "etag", "objectType"].includes(key)
      ? undefined
      : recordProperties[key]
  const cached = normalized.get(value)
  if (cached) return cached
  const property = normalizeProperties({ value }).value
  normalized.set(value, property)
  return property
}
const scalarOperators = {
  equality: ["eq", "in"],
  ordered: ["eq", "gt", "gte", "in", "lt", "lte"],
  text: ["contains", "endsWith", "eq", "in", "startsWith"],
} as const

type ScalarOperators<P> = P extends { kind: "boolean" | "enum" | "recordId" }
  ? (typeof scalarOperators.equality)[number]
  : P extends
        | { kind: "decimal" | "number" }
        | { kind: "string"; format: "date" | "timestamp" }
    ? (typeof scalarOperators.ordered)[number]
    : P extends { kind: "string" }
      ? (typeof scalarOperators.text)[number]
      : never

export type PropertyFilterOperator<P> = P extends { secret: true }
  ? never
  : ScalarOperators<P> extends never
    ? never
    : ScalarOperators<P> | (P extends { nullable: true } ? "isNull" : never)

export function fieldOperators(property: AnySchema): ReadonlyArray<string> {
  if (containsSecret(property)) return []
  const metadata: { kind: string; nullable?: boolean } = property
  const nullable = metadata.nullable ? ["isNull"] : []
  switch (property.kind) {
    case "boolean":
    case "enum":
    case "recordId":
      return [...scalarOperators.equality, ...nullable]
    case "decimal":
    case "number":
      return [...scalarOperators.ordered, ...nullable]
    case "string":
      return [
        ...(property.format === "date" || property.format === "timestamp"
          ? scalarOperators.ordered
          : scalarOperators.text),
        ...nullable,
      ]
    default:
      return []
  }
}

/** PostgreSQL min/max operate on ordered scalar values, excluding booleans. */
function canAggregateField(property: AnySchema): boolean {
  if (containsSecret(property)) return false
  return ["decimal", "enum", "number", "recordId", "string"].includes(
    property.kind
  )
}

/** One interpretation of public paths for schema descriptions, SQL and UI. No enumerated graph or generated source. */
export function resolveQueryField(
  model: ModelCatalog,
  object: QueryType,
  path: string,
  aggregate?: "count" | "min" | "max" | "preview"
) {
  const parts = path.split(".")
  const count = aggregate === "count" || parts.at(-1) === "$count"
  if (parts.at(-1) === "$count") parts.pop()
  if (count && parts.length !== 1)
    throw new Error("Count requires a link key, without a property path.")
  let current: QueryType = object
  const traversals: LinkTraversal[] = []
  const linkKeys = count ? parts : parts.slice(0, -1)
  if (linkKeys.length > 3)
    throw new Error("Link paths may contain at most three traversals.")
  for (const key of linkKeys) {
    const traversal = modelLinkTraversals(model, current.id).find(
      (entry) => entry.traversal.key === key
    )?.traversal
    if (!traversal) throw new Error(`Unknown link '${current.id}.${key}'.`)
    if (traversal.max !== 1 && !count && aggregate === undefined)
      throw new Error(
        `Plural link '${key}' requires a quantifier or aggregate.`
      )
    if (traversals.length > 0 && traversal.max !== 1 && aggregate !== "preview")
      throw new Error(
        "Aggregate paths may traverse only one plural link, at the first hop."
      )
    traversals.push(traversal)
    current =
      model.objects[traversal.to.typeId] ??
      model.interfaces[traversal.to.typeId]!
  }
  const key = parts.at(-1)!
  if (key === "label" && traversals.length > 0)
    throw new Error(
      "Query labels on their own collection; related paths must name stored fields."
    )
  const property = count
    ? normalizeProperties({ count: schema.number() }).count
    : queryProperty(current, key)
  if (!property) throw new Error(`Unknown field '${object.id}.${path}'.`)
  if (
    aggregate &&
    aggregate !== "preview" &&
    !count &&
    !canAggregateField(property)
  )
    throw new Error(`Field '${path}' cannot be aggregated.`)
  return {
    path,
    traversals,
    target: current,
    key,
    count,
    property: {
      ...property,
      nullable:
        property.nullable ||
        (!count && traversals.some((end) => end.min === 0)),
    },
  }
}
