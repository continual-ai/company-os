import { definitionId } from "./identity"
import type { InterfaceType } from "./interface"
import type { ObjectType } from "./object"

type LinkTarget = InterfaceType | ObjectType

export const linkCardinalities = ["one", "zeroOrOne", "many"] as const

export type LinkCardinality = (typeof linkCardinalities)[number]

export interface LinkSide<
  TTypeId extends string = string,
  TName extends string = string,
  TCardinality extends LinkCardinality = LinkCardinality,
> {
  cardinality: TCardinality
  name: TName
  typeId: TTypeId
}

export interface LinkType<
  TId extends string = string,
  TFrom extends LinkSide = LinkSide,
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
  const TFromObject extends LinkTarget,
  const TFromName extends string,
  const TFromCardinality extends LinkCardinality,
  const TToObject extends LinkTarget,
  const TToName extends string,
  const TToCardinality extends LinkCardinality,
>(definition: {
  description?: string
  from: {
    cardinality: TFromCardinality
    name: TFromName
    type: TFromObject
  }
  id: TId
  name: string
  to: {
    cardinality: TToCardinality
    name: TToName
    type: TToObject
  }
}): LinkType<
  TId,
  LinkSide<TFromObject["id"], TFromName, TFromCardinality>,
  LinkSide<TToObject["id"], TToName, TToCardinality>
> {
  const { from, to } = definition

  definitionId(from.name)
  definitionId(to.name)

  const link: LinkType<
    TId,
    LinkSide<TFromObject["id"], TFromName, TFromCardinality>,
    LinkSide<TToObject["id"], TToName, TToCardinality>
  > = {
    kind: "link",
    id: definitionId(definition.id),
    name: definition.name,
    from: {
      cardinality: from.cardinality,
      name: from.name,
      typeId: from.type.id,
    },
    to: {
      cardinality: to.cardinality,
      name: to.name,
      typeId: to.type.id,
    },
  }
  if (definition.description !== undefined) {
    link.description = definition.description
  }
  return link
}
