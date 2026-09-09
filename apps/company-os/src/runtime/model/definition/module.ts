import type { EventType } from "#/runtime/model/definition/event.ts"
import type { InterfaceType } from "#/runtime/model/definition/interface.ts"
import type { LinkType } from "#/runtime/model/definition/link.ts"
import type { ObjectType } from "#/runtime/model/definition/object.ts"

/** A portable, cohesive group of model definitions. */
export interface ModuleDefinition<
  TId extends string = string,
  TInterfaces extends ReadonlyArray<InterfaceType> =
    ReadonlyArray<InterfaceType>,
  TLinks extends ReadonlyArray<LinkType> = ReadonlyArray<LinkType>,
  TObjects extends ReadonlyArray<ObjectType> = ReadonlyArray<ObjectType>,
> {
  readonly events: ReadonlyArray<EventType>
  readonly id: TId
  readonly interfaces: TInterfaces
  readonly kind: "module"
  readonly links: TLinks
  readonly name: string
  readonly objects: TObjects
}

/**
 * Defines a browser-safe model capability for composition into a model. A
 * module's dependencies are derived from the types its definitions reference,
 * so they are never declared by hand.
 */
export function defineModule<
  const TId extends string,
  const TObjects extends ReadonlyArray<ObjectType>,
  const TInterfaces extends ReadonlyArray<InterfaceType> = readonly [],
  const TLinks extends ReadonlyArray<LinkType> = readonly [],
>(definition: {
  readonly events?: ReadonlyArray<EventType>
  readonly id: TId
  readonly interfaces?: TInterfaces
  readonly links?: TLinks
  readonly name: string
  readonly objects: TObjects
}): ModuleDefinition<TId, TInterfaces, TLinks, TObjects> {
  // SAFETY: an omitted list is exactly the generic default `readonly []`.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const interfaces = (definition.interfaces ?? []) as TInterfaces
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const links = (definition.links ?? []) as TLinks
  return {
    events: definition.events ?? [],
    id: definition.id,
    interfaces,
    kind: "module",
    links,
    name: definition.name,
    objects: definition.objects,
  }
}
