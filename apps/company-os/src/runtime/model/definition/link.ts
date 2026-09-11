import {
  definitionId,
  type NoExtraKeys,
  type OpenOr,
} from "#/runtime/model/definition/identity.ts"
import type { InterfaceType } from "#/runtime/model/definition/interface.ts"
import type { ObjectType } from "#/runtime/model/definition/object.ts"

type LinkTarget = InterfaceType | ObjectType

export interface LinkEndpoint<
  TTypeId extends string = string,
  TKind extends LinkTarget["kind"] = LinkTarget["kind"],
> {
  kind: TKind
  typeId: TTypeId
}

interface LinkEndDefinition {
  readonly key: string
  readonly label: string
  readonly description?: string
  readonly min?: number
  readonly max?: number
  /** Deleting the source deletes these targets. Ordinary unlinking never deletes records. */
  readonly onDelete?: "unlink" | "cascade"
}

export interface LinkTraversal<
  TFrom extends LinkEndpoint = LinkEndpoint,
  TTo extends LinkEndpoint = LinkEndpoint,
  TKey extends string = string,
  TMin extends number = number,
  TMax extends number | undefined = number | undefined,
> {
  from: TFrom
  to: TTo
  key: TKey
  label: string
  description?: string
  min: TMin
  max: TMax
  onDelete: "unlink" | "cascade"
}

export interface LinkDefinition {
  readonly id: string
  readonly name: string
  readonly description?: string
  readonly from: LinkTarget
  readonly to: LinkTarget
  readonly forward: LinkEndDefinition
  readonly reverse: LinkEndDefinition
  readonly outputOnly?: boolean
  readonly subsetOf?: LinkType
}

type EndpointOf<T extends LinkTarget> = LinkEndpoint<T["id"], T["kind"]>
type EndOf<
  E extends LinkEndDefinition,
  F extends LinkTarget,
  T extends LinkTarget,
> = LinkTraversal<
  EndpointOf<F>,
  EndpointOf<T>,
  E["key"],
  E extends { readonly min: infer N extends number } ? N : 0,
  E extends { readonly max: infer N extends number } ? N : undefined
>

export interface LinkType<D extends LinkDefinition = LinkDefinition> {
  kind: "link"
  id: D["id"]
  name: string
  description?: string
  outputOnly: OpenOr<
    D,
    boolean,
    D extends { readonly outputOnly: true } ? true : false
  >
  subsetOf?: string
  forward: OpenOr<D, LinkTraversal, EndOf<D["forward"], D["from"], D["to"]>>
  reverse: OpenOr<D, LinkTraversal, EndOf<D["reverse"], D["to"], D["from"]>>
}

function traversal(
  end: LinkEndDefinition,
  from: LinkTarget,
  to: LinkTarget
): LinkTraversal {
  const min = end.min ?? 0
  const max = end.max
  if (
    !Number.isSafeInteger(min) ||
    min < 0 ||
    (max !== undefined && (!Number.isSafeInteger(max) || max < min))
  )
    throw new Error(
      `Link traversal '${end.key}' requires integer bounds with 0 <= min <= max.`
    )
  return {
    ...end,
    key: definitionId(end.key),
    from: { kind: from.kind, typeId: from.id },
    to: { kind: to.kind, typeId: to.id },
    min,
    max,
    onDelete: end.onDelete ?? "unlink",
  }
}

/** One stored relationship, with two named traversals and constraints on both ends. */
export function defineLink<const D extends LinkDefinition>(
  definition: D &
    NoExtraKeys<D, LinkDefinition> & {
      readonly forward: D["forward"] &
        NoExtraKeys<D["forward"], LinkEndDefinition>
      readonly reverse: D["reverse"] &
        NoExtraKeys<D["reverse"], LinkEndDefinition>
    }
): LinkType<D> {
  const input: LinkDefinition = definition
  const forward = traversal(input.forward, input.from, input.to)
  const reverse = traversal(input.reverse, input.to, input.from)
  if (
    input.subsetOf !== undefined &&
    (input.subsetOf.forward.from.typeId !== input.from.id ||
      input.subsetOf.reverse.from.typeId !== input.to.id ||
      input.subsetOf.subsetOf !== undefined)
  )
    throw new Error(
      `Link '${input.id}' must select from a relationship with identical endpoints.`
    )
  if (
    (forward.onDelete === "cascade" && reverse.max !== 1) ||
    (reverse.onDelete === "cascade" && forward.max !== 1) ||
    (forward.onDelete === "cascade" && reverse.onDelete === "cascade")
  )
    throw new Error(
      `Link '${input.id}' cascade targets must have at most one owner and cannot cascade back.`
    )
  const link: LinkType = {
    kind: "link",
    id: definitionId(input.id),
    name: input.name,
    outputOnly: input.outputOnly ?? false,
    forward,
    reverse,
    ...(input.description === undefined
      ? {}
      : { description: input.description }),
    ...(input.subsetOf === undefined ? {} : { subsetOf: input.subsetOf.id }),
  }
  // SAFETY: normalized traversals preserve the literal keys, endpoint types, and supplied bounds.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return link as LinkType<D>
}
