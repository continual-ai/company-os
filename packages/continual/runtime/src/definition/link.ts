import { definitionId } from "./identity"
import type { ObjectType } from "./object"

export const linkCardinalities = ["one", "zeroOrOne", "many"] as const

export type LinkCardinality = (typeof linkCardinalities)[number]

export interface LinkSide<
  TObjectId extends string = string,
  TName extends string = string,
  TCardinality extends LinkCardinality = LinkCardinality,
> {
  cardinality: TCardinality
  name: TName
  objectId: TObjectId
}

export interface LinkType<
  TId extends string = string,
  TFrom extends LinkSide & { property: string } = LinkSide & {
    property: string
  },
  TTo extends LinkSide = LinkSide,
> {
  description?: string
  from: TFrom
  id: TId
  kind: "link"
  name: string
  to: TTo
}

export function defineLink<
  const TId extends string,
  const TFromObject extends ObjectType,
  const TFromName extends string,
  const TFromCardinality extends LinkCardinality,
  const TProperty extends keyof TFromObject["properties"] & string,
  const TToObject extends ObjectType,
  const TToName extends string,
  const TToCardinality extends LinkCardinality,
>(definition: {
  description?: string
  from: {
    cardinality: TFromCardinality
    name: TFromName
    object: TFromObject
    property: TProperty
  }
  id: TId
  name: string
  to: {
    cardinality: TToCardinality
    name: TToName
    object: TToObject
  }
}): LinkType<
  TId,
  LinkSide<TFromObject["id"], TFromName, TFromCardinality> & {
    property: TProperty
  },
  LinkSide<TToObject["id"], TToName, TToCardinality>
> {
  const { from, to } = definition
  const property = from.object.properties[from.property]

  definitionId(from.name)
  definitionId(to.name)

  if (property === undefined || property.kind !== "recordId") {
    throw new Error(
      `Link '${definition.id}' storage property '${from.object.id}.${from.property}' must be a record ID.`
    )
  }
  if (property.objectId !== to.object.id) {
    throw new Error(
      `Link '${definition.id}' storage property '${from.object.id}.${from.property}' must reference object '${to.object.id}'.`
    )
  }
  if (from.cardinality === "many") {
    throw new Error(
      `Link '${definition.id}' cannot store a many-valued side in scalar record ID property '${from.object.id}.${from.property}'.`
    )
  }
  if ((from.cardinality === "zeroOrOne") !== property.nullable) {
    throw new Error(
      `Link '${definition.id}' cardinality must match the nullability of storage property '${from.object.id}.${from.property}'.`
    )
  }

  const link: LinkType<
    TId,
    LinkSide<TFromObject["id"], TFromName, TFromCardinality> & {
      property: TProperty
    },
    LinkSide<TToObject["id"], TToName, TToCardinality>
  > = {
    kind: "link",
    id: definitionId(definition.id),
    name: definition.name,
    from: {
      cardinality: from.cardinality,
      name: from.name,
      objectId: from.object.id,
      property: from.property,
    },
    to: {
      cardinality: to.cardinality,
      name: to.name,
      objectId: to.object.id,
    },
  }
  if (definition.description !== undefined) {
    link.description = definition.description
  }
  return link
}
