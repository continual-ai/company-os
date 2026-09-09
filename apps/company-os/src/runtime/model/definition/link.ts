import {
  definitionId,
  type NoExtraKeys,
} from "#/runtime/model/definition/identity.ts"
import type { InterfaceType } from "#/runtime/model/definition/interface.ts"
import type { ObjectType } from "#/runtime/model/definition/object.ts"

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

interface LinkTraversalDefinition {
  readonly cardinality: LinkCardinality
  readonly description?: string
  readonly from: LinkTarget
  readonly key: string
  readonly label: string
  readonly to: LinkTarget
}

/**
 * What `defineLink` accepts. The parameter additionally requires `reverse` to
 * mirror the forward endpoints and `writeFrom` to name one traversal key.
 */
export interface LinkDefinition {
  readonly description?: string
  readonly forward: LinkTraversalDefinition
  readonly id: string
  readonly name: string
  readonly reverse: LinkTraversalDefinition
  readonly subsetOf?: LinkType
  readonly writeFrom: string | false
}

type LinkDefinitionConstraints<D extends LinkDefinition> = NoExtraKeys<
  D,
  LinkDefinition
> & {
  readonly reverse: {
    readonly from: D["forward"]["to"]
    readonly to: D["forward"]["from"]
  }
  readonly writeFrom: D["forward"]["key"] | D["reverse"]["key"] | false
}

type LinkEndpointOf<TTarget extends LinkTarget> = LinkEndpoint<
  TTarget["id"],
  TTarget["kind"]
>

type LinkTraversalOf<TTraversal extends LinkTraversalDefinition> =
  LinkTraversal<
    LinkEndpointOf<TTraversal["from"]>,
    LinkEndpointOf<TTraversal["to"]>,
    TTraversal["key"],
    TTraversal["cardinality"]
  >

/** A defined link; the bare `LinkType` is the open form every defined link is assignable to. */
export interface LinkType<D extends LinkDefinition = LinkDefinition> {
  description?: string
  /** A role selection within another relationship, with identical endpoint orientation. */
  subsetOf?: string
  forward: LinkTraversalOf<D["forward"]>
  id: D["id"]
  kind: "link"
  name: string
  reverse: LinkTraversalOf<D["reverse"]>
  /** Key of the one traversal that owns public mutations, or false when immutable. */
  writeFrom: D["writeFrom"]
}

/**
 * Defines both named traversals of a portable business relationship. The
 * contract leaves storage and protocol projection unspecified.
 */
export function defineLink<const D extends LinkDefinition>(
  definition: D & LinkDefinitionConstraints<D>
): LinkType<D> {
  const input: LinkDefinition = definition
  const { forward, reverse } = input
  if (
    input.subsetOf !== undefined &&
    (input.subsetOf.forward.from.typeId !== forward.from.id ||
      input.subsetOf.reverse.from.typeId !== reverse.from.id ||
      input.subsetOf.forward.cardinality !== "many" ||
      input.subsetOf.reverse.cardinality !== "many" ||
      input.subsetOf.subsetOf !== undefined)
  )
    throw new Error(
      `Link '${input.id}' must select from a many-to-many relationship with identical endpoints.`
    )

  definitionId(forward.key)
  definitionId(reverse.key)
  if (
    forward.from.id !== reverse.to.id ||
    forward.from.kind !== reverse.to.kind ||
    forward.to.id !== reverse.from.id ||
    forward.to.kind !== reverse.from.kind
  ) {
    throw new Error(
      `Link '${input.id}' reverse traversal must mirror its forward endpoints.`
    )
  }
  if (
    input.writeFrom !== false &&
    input.writeFrom !== forward.key &&
    input.writeFrom !== reverse.key
  ) {
    throw new Error(
      `Link '${input.id}' writeFrom must name one of its traversal keys.`
    )
  }

  const link: LinkType = {
    kind: "link",
    ...(input.subsetOf === undefined ? {} : { subsetOf: input.subsetOf.id }),
    id: definitionId(input.id),
    name: input.name,
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
    writeFrom: input.writeFrom,
  }
  if (forward.description !== undefined) {
    link.forward.description = forward.description
  }
  if (reverse.description !== undefined) {
    link.reverse.description = reverse.description
  }
  if (input.description !== undefined) {
    link.description = input.description
  }
  // SAFETY: every member was built from the same definition the return type derives from.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return link as LinkType<D>
}
