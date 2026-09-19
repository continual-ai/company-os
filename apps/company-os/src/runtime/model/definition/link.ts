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
  readonly object: LinkTarget
  readonly key: string
  readonly label?: string
  readonly description?: string
  readonly min?: 0 | 1
  readonly max?: 1
  /** Deleting the source deletes these targets. Ordinary unlinking never deletes records. */
  readonly onDelete?: "unlink" | "restrict" | "cascade"
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
  onDelete: "unlink" | "restrict" | "cascade"
}

export interface LinkDefinition {
  readonly id: string
  readonly name?: string
  readonly description?: string
  readonly from: LinkEndDefinition
  readonly to: LinkEndDefinition
  readonly outputOnly?: boolean
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
  forward: OpenOr<
    D,
    LinkTraversal,
    EndOf<D["from"], D["from"]["object"], D["to"]["object"]>
  >
  reverse: OpenOr<
    D,
    LinkTraversal,
    EndOf<D["to"], D["to"]["object"], D["from"]["object"]>
  >
}

function traversal(
  end: LinkEndDefinition,
  from: LinkTarget,
  to: LinkTarget
): LinkTraversal {
  const min = end.min ?? 0
  const max = end.max
  if (
    (min !== 0 && min !== 1) ||
    (max !== undefined && max !== 1) ||
    (min === 1 && max !== 1)
  )
    throw new Error(
      `Link traversal '${end.key}' supports only optional singular, required singular, or unbounded plural bounds.`
    )
  return {
    label: end.label ?? (max === 1 ? to.name : to.pluralName),
    ...(end.description === undefined ? {} : { description: end.description }),
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
      readonly from: D["from"] & NoExtraKeys<D["from"], LinkEndDefinition>
      readonly to: D["to"] & NoExtraKeys<D["to"], LinkEndDefinition>
    }
): LinkType<D> {
  const input: LinkDefinition = definition
  const forward = traversal(input.from, input.from.object, input.to.object)
  const reverse = traversal(input.to, input.to.object, input.from.object)
  if (forward.min === 1 && reverse.min === 1)
    throw new Error(`Link '${input.id}' cannot require existence on both ends.`)
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
    name: input.name ?? `${input.from.object.name} ${input.from.key}`,
    outputOnly: input.outputOnly ?? false,
    forward,
    reverse,
    ...(input.description === undefined
      ? {}
      : { description: input.description }),
  }
  // SAFETY: normalized traversals preserve the literal keys, endpoint types, and supplied bounds.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return link as LinkType<D>
}

/** The singular end stores the reference; a required end takes precedence over the authored from end. */
export function linkReferenceSide(
  link: LinkType
): "forward" | "reverse" | undefined {
  return link.reverse.min === 1
    ? "reverse"
    : link.forward.max === 1
      ? "forward"
      : link.reverse.max === 1
        ? "reverse"
        : undefined
}
