import { definitionId } from "./identity"
import type { InterfaceType } from "./interface"
import type { ObjectType } from "./object"

type LinkTarget = InterfaceType | ObjectType

export const linkCardinalities = ["one", "zeroOrOne", "many"] as const

export type LinkCardinality = (typeof linkCardinalities)[number]

export interface LinkSide<
  TTypeId extends string = string,
  TKey extends string = string,
  TCardinality extends LinkCardinality = LinkCardinality,
> {
  cardinality: TCardinality
  description?: string
  key: TKey
  label: string
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
  const TFromType extends LinkTarget,
  const TFromKey extends string,
  const TFromCardinality extends LinkCardinality,
  const TToType extends LinkTarget,
  const TToKey extends string,
  const TToCardinality extends LinkCardinality,
>(definition: {
  description?: string
  from: {
    cardinality: TFromCardinality
    description?: string
    key: TFromKey
    label: string
    type: TFromType
  }
  id: TId
  name: string
  to: {
    cardinality: TToCardinality
    description?: string
    key: TToKey
    label: string
    type: TToType
  }
}): LinkType<
  TId,
  LinkSide<TFromType["id"], TFromKey, TFromCardinality>,
  LinkSide<TToType["id"], TToKey, TToCardinality>
> {
  const { from, to } = definition

  definitionId(from.key)
  definitionId(to.key)
  if (from.cardinality === "many" && to.cardinality !== "many") {
    throw new Error(
      `Link '${definition.id}' must put its singular reference-bearing side in 'from'; swap the link sides.`
    )
  }

  const link: LinkType<
    TId,
    LinkSide<TFromType["id"], TFromKey, TFromCardinality>,
    LinkSide<TToType["id"], TToKey, TToCardinality>
  > = {
    kind: "link",
    id: definitionId(definition.id),
    name: definition.name,
    from: {
      cardinality: from.cardinality,
      key: from.key,
      label: from.label,
      typeId: from.type.id,
    },
    to: {
      cardinality: to.cardinality,
      key: to.key,
      label: to.label,
      typeId: to.type.id,
    },
  }
  if (from.description !== undefined) {
    link.from.description = from.description
  }
  if (to.description !== undefined) link.to.description = to.description
  if (definition.description !== undefined) {
    link.description = definition.description
  }
  return link
}
