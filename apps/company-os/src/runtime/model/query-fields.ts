import type { LinkTraversal } from "#/runtime/model/definition/link.ts"
import {
  modelLinkTraversals,
  type ModelCatalog,
} from "#/runtime/model/definition/model.ts"
import {
  normalizeProperties,
  type PropertyDefinition,
} from "#/runtime/model/definition/property.ts"
import { schema, type AnySchema } from "#/runtime/model/definition/schema.ts"

export interface QueryType {
  readonly id: string
  readonly properties: Readonly<Record<string, AnySchema>>
}

const normalized = new WeakMap<AnySchema, PropertyDefinition>()

const systemFields: Readonly<Record<string, PropertyDefinition>> =
  normalizeProperties({
    label: schema.string(),
    id: schema.id({ id: "object" }),
    createdBy: schema.id({ id: "actor" }),
    updatedBy: schema.id({ id: "actor" }),
    createdAt: schema.timestamp(),
    updatedAt: schema.timestamp(),
    systemManaged: schema.boolean(),
  })
export function queryProperty(
  object: { readonly properties: Readonly<Record<string, AnySchema>> },
  key: string
): PropertyDefinition | undefined {
  const value = object.properties[key]
  if (!value) return systemFields[key]
  const cached = normalized.get(value)
  if (cached) return cached
  const property = normalizeProperties({ value }).value
  normalized.set(value, property)
  return property
}
export function fieldOperators(property: AnySchema): ReadonlyArray<string> {
  const metadata: { readonly kind: string; readonly nullable?: boolean } =
    property
  const nullable = metadata.nullable ? ["isNull"] : []
  switch (property.kind) {
    case "boolean":
    case "enum":
    case "recordId":
      return ["eq", "in", ...nullable]
    case "decimal":
    case "number":
      return ["eq", "gt", "gte", "in", "lt", "lte", ...nullable]
    case "string":
      return property.format === "date" || property.format === "timestamp"
        ? ["eq", "gt", "gte", "in", "lt", "lte", ...nullable]
        : ["contains", "endsWith", "eq", "in", "startsWith", ...nullable]
    default:
      return []
  }
}

/** PostgreSQL min/max operate on ordered scalar values, excluding booleans. */
function canAggregateField(property: AnySchema): boolean {
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
    throw new Error(
      "Count requires a relationship key, without a property path."
    )
  let current: QueryType = object
  const traversals: LinkTraversal[] = []
  const relationshipKeys = count ? parts : parts.slice(0, -1)
  if (relationshipKeys.length > 3)
    throw new Error("Relationship paths may contain at most three traversals.")
  for (const key of relationshipKeys) {
    const traversal = modelLinkTraversals(model, current.id).find(
      (entry) => entry.traversal.key === key
    )?.traversal
    if (!traversal)
      throw new Error(`Unknown relationship '${current.id}.${key}'.`)
    if (traversal.max !== 1 && !count && aggregate === undefined)
      throw new Error(
        `Plural relationship '${key}' requires a quantifier or aggregate.`
      )
    if (traversals.length > 0 && traversal.max !== 1 && aggregate !== "preview")
      throw new Error(
        "Aggregate paths may traverse only one plural relationship, at the first hop."
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
