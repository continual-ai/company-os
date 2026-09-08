import type { InterfaceType } from "#/model/definition/interface.ts"
import type { LinkType } from "#/model/definition/link.ts"
import type { ObjectType } from "#/model/definition/object.ts"
import type { AnySchema } from "#/model/definition/schema.ts"

/** A portable, cohesive group of model definitions. */
export interface ModuleDefinition<
  TId extends string = string,
  TInterfaces extends ReadonlyArray<InterfaceType> =
    ReadonlyArray<InterfaceType>,
  TLinks extends ReadonlyArray<LinkType> = ReadonlyArray<LinkType>,
  TObjects extends ReadonlyArray<ObjectType> = ReadonlyArray<ObjectType>,
> {
  readonly id: TId
  readonly interfaces: TInterfaces
  readonly kind: "module"
  readonly links: TLinks
  readonly name: string
  /** Other modules that must be explicitly composed alongside this one. */
  readonly requires?: ReadonlyArray<string>
  readonly events?: ReadonlyArray<{
    readonly type: string
    readonly version: number
    readonly subject: ObjectType
    readonly data: AnySchema
  }>
  readonly objects: TObjects
}

/** Defines a browser-safe model capability for composition into a model. */
export function defineModule<
  const TId extends string,
  const TInterfaces extends ReadonlyArray<InterfaceType>,
  const TLinks extends ReadonlyArray<LinkType>,
  const TObjects extends ReadonlyArray<ObjectType>,
>(definition: {
  readonly id: TId
  readonly interfaces: TInterfaces
  readonly links: TLinks
  readonly name: string
  /** Other modules that must be explicitly composed alongside this one. */
  readonly requires?: ReadonlyArray<string>
  readonly events?: ReadonlyArray<{
    readonly type: string
    readonly version: number
    readonly subject: ObjectType
    readonly data: AnySchema
  }>
  readonly objects: TObjects
}): ModuleDefinition<TId, TInterfaces, TLinks, TObjects> {
  return { ...definition, kind: "module" }
}
