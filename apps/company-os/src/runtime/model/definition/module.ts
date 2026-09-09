import type { EventType } from "#/runtime/model/definition/event.ts"
import type {
  NoExtraKeys,
  OpenOr,
} from "#/runtime/model/definition/identity.ts"
import type { InterfaceType } from "#/runtime/model/definition/interface.ts"
import type { LinkType } from "#/runtime/model/definition/link.ts"
import type { ObjectType } from "#/runtime/model/definition/object.ts"

/** What `defineModule` accepts. */
export interface ModuleDefinitionInput {
  readonly events?: ReadonlyArray<EventType>
  readonly id: string
  readonly interfaces?: ReadonlyArray<InterfaceType>
  readonly links?: ReadonlyArray<LinkType>
  readonly name: string
  readonly objects: ReadonlyArray<ObjectType>
}

type ModuleInterfaces<D extends ModuleDefinitionInput> = D extends {
  readonly interfaces: infer TInterfaces extends ReadonlyArray<InterfaceType>
}
  ? TInterfaces
  : readonly []

type ModuleLinks<D extends ModuleDefinitionInput> = D extends {
  readonly links: infer TLinks extends ReadonlyArray<LinkType>
}
  ? TLinks
  : readonly []

/**
 * A portable, cohesive group of model definitions; the bare `ModuleDefinition`
 * is the open form every defined module is assignable to.
 */
export interface ModuleDefinition<
  D extends ModuleDefinitionInput = ModuleDefinitionInput,
> {
  readonly events: ReadonlyArray<EventType>
  readonly id: D["id"]
  readonly interfaces: OpenOr<
    D,
    ReadonlyArray<InterfaceType>,
    ModuleInterfaces<D>
  >
  readonly kind: "module"
  readonly links: OpenOr<D, ReadonlyArray<LinkType>, ModuleLinks<D>>
  readonly name: string
  readonly objects: D["objects"]
}

/**
 * Defines a browser-safe model capability for composition into a model. A
 * module's dependencies are derived from the types its definitions reference,
 * so they are never declared by hand.
 */
export function defineModule<const D extends ModuleDefinitionInput>(
  definition: D & NoExtraKeys<D, ModuleDefinitionInput>
): ModuleDefinition<D> {
  const input: ModuleDefinitionInput = definition
  const module: ModuleDefinition = {
    events: input.events ?? [],
    id: input.id,
    interfaces: input.interfaces ?? [],
    kind: "module",
    links: input.links ?? [],
    name: input.name,
    objects: input.objects,
  }
  // SAFETY: an omitted list is exactly the derived `readonly []`; every other
  // member is the definition's own value.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return module as ModuleDefinition<D>
}
