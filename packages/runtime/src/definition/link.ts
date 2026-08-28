import { definitionId } from "./identity"
import type { InterfaceType } from "./interface"
import type { ObjectType } from "./object"

type LinkTarget = InterfaceType | ObjectType

export const linkCardinalities = ["one", "zeroOrOne", "many"] as const

export type LinkCardinality = (typeof linkCardinalities)[number]

export interface LinkEndpoint<
  TTypeId extends string = string,
  TKind extends LinkTarget["kind"] = LinkTarget["kind"],
> {
  kind: TKind
  typeId: TTypeId
}

export interface LinkTraversal<
  TFrom extends LinkEndpoint = LinkEndpoint,
  TTo extends LinkEndpoint = LinkEndpoint,
  TKey extends string = string,
  TCardinality extends LinkCardinality = LinkCardinality,
> {
  cardinality: TCardinality
  description?: string
  from: TFrom
  key: TKey
  label: string
  to: TTo
}

export interface LinkType<
  TId extends string = string,
  TForward extends LinkTraversal = LinkTraversal,
  TReverse extends LinkTraversal = LinkTraversal,
  TWriteFrom extends TForward["key"] | TReverse["key"] | false =
    | TForward["key"]
    | TReverse["key"]
    | false,
> {
  description?: string
  forward: TForward
  id: TId
  kind: "link"
  name: string
  reverse: TReverse
  /** Key of the one traversal that owns public mutations, or false when immutable. */
  writeFrom: TWriteFrom
}

/**
 * Defines both named traversals of a portable business relationship. The
 * contract leaves storage and protocol projection unspecified.
 */
export function defineLink<
  const TId extends string,
  const TForwardFrom extends LinkTarget,
  const TForwardTo extends LinkTarget,
  const TForwardKey extends string,
  const TForwardCardinality extends LinkCardinality,
  const TReverseKey extends string,
  const TReverseCardinality extends LinkCardinality,
  const TWriteFrom extends TForwardKey | TReverseKey | false,
>(definition: {
  description?: string
  forward: {
    cardinality: TForwardCardinality
    description?: string
    from: TForwardFrom
    key: TForwardKey
    label: string
    to: TForwardTo
  }
  id: TId
  name: string
  reverse: {
    cardinality: TReverseCardinality
    description?: string
    from: TForwardTo
    key: TReverseKey
    label: string
    to: TForwardFrom
  }
  writeFrom: TWriteFrom
}): LinkType<
  TId,
  LinkTraversal<
    LinkEndpoint<TForwardFrom["id"], TForwardFrom["kind"]>,
    LinkEndpoint<TForwardTo["id"], TForwardTo["kind"]>,
    TForwardKey,
    TForwardCardinality
  >,
  LinkTraversal<
    LinkEndpoint<TForwardTo["id"], TForwardTo["kind"]>,
    LinkEndpoint<TForwardFrom["id"], TForwardFrom["kind"]>,
    TReverseKey,
    TReverseCardinality
  >,
  TWriteFrom
> {
  const { forward, reverse } = definition

  definitionId(forward.key)
  definitionId(reverse.key)
  if (
    forward.from.id !== reverse.to.id ||
    forward.from.kind !== reverse.to.kind ||
    forward.to.id !== reverse.from.id ||
    forward.to.kind !== reverse.from.kind
  ) {
    throw new Error(
      `Link '${definition.id}' reverse traversal must mirror its forward endpoints.`
    )
  }
  if (
    definition.writeFrom !== false &&
    definition.writeFrom !== forward.key &&
    definition.writeFrom !== reverse.key
  ) {
    throw new Error(
      `Link '${definition.id}' writeFrom must name one of its traversal keys.`
    )
  }

  const link: LinkType<
    TId,
    LinkTraversal<
      LinkEndpoint<TForwardFrom["id"], TForwardFrom["kind"]>,
      LinkEndpoint<TForwardTo["id"], TForwardTo["kind"]>,
      TForwardKey,
      TForwardCardinality
    >,
    LinkTraversal<
      LinkEndpoint<TForwardTo["id"], TForwardTo["kind"]>,
      LinkEndpoint<TForwardFrom["id"], TForwardFrom["kind"]>,
      TReverseKey,
      TReverseCardinality
    >,
    TWriteFrom
  > = {
    kind: "link",
    id: definitionId(definition.id),
    name: definition.name,
    forward: {
      cardinality: forward.cardinality,
      from: { kind: forward.from.kind, typeId: forward.from.id },
      key: forward.key,
      label: forward.label,
      to: { kind: forward.to.kind, typeId: forward.to.id },
    },
    reverse: {
      cardinality: reverse.cardinality,
      from: { kind: reverse.from.kind, typeId: reverse.from.id },
      key: reverse.key,
      label: reverse.label,
      to: { kind: reverse.to.kind, typeId: reverse.to.id },
    },
    writeFrom: definition.writeFrom,
  }
  if (forward.description !== undefined) {
    link.forward.description = forward.description
  }
  if (reverse.description !== undefined) {
    link.reverse.description = reverse.description
  }
  if (definition.description !== undefined) {
    link.description = definition.description
  }
  return link
}
