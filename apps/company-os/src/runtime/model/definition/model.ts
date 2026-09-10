import { Actor } from "#/runtime/model/core/actor.ts"
import { Root, type RootType } from "#/runtime/model/core/root.ts"
import type { Action } from "#/runtime/model/definition/action.ts"
import type { InterfaceType } from "#/runtime/model/definition/interface.ts"
import type { LinkType } from "#/runtime/model/definition/link.ts"
import type { ModuleDefinition } from "#/runtime/model/definition/module.ts"
import type {
  ObjectDefinition,
  ObjectRef,
  ObjectType,
} from "#/runtime/model/definition/object.ts"
import {
  standardQueries,
  type Query,
  type CustomQuery,
  type StandardQueries,
} from "#/runtime/model/definition/query.ts"
import { modelRelationships } from "#/runtime/model/definition/relationship.ts"
import type {
  RecordId,
  RecordIdSchema,
} from "#/runtime/model/definition/schema.ts"
import {
  assertModelDefinitionsValid,
  assertModulesClosed,
  assertRelationshipNamesUnambiguous,
} from "#/runtime/model/definition/validate-model.ts"

/** Interfaces the kernel defines; every model registers them before its modules. */
const coreInterfaces = [Actor] as const
type CoreInterface = (typeof coreInterfaces)[number]

type RecordIds<TTypeId extends string> = TTypeId extends string
  ? RecordId<TTypeId>
  : never

type RootImplements<TInterfaceId extends string> =
  TInterfaceId extends keyof RootType["interfaces"] ? RootType["id"] : never

type InterfaceImplementerId<
  TObjects extends ReadonlyArray<ObjectType>,
  TInterfaceId extends string,
> =
  | InterfaceImplementerIdFor<TObjects[number], TInterfaceId>
  | RootImplements<TInterfaceId>

type InterfaceImplementerIdFor<
  TObject,
  TInterfaceId extends string,
> = TObject extends ObjectType
  ? TInterfaceId extends keyof TObject["interfaces"]
    ? TObject["id"]
    : never
  : never

/** Interface references resolve to the model's implementers; concrete references are already exact. */
type BoundProperty<TProperty, TObjects extends ReadonlyArray<ObjectType>> =
  TProperty extends RecordIdSchema<infer TTargetTypeId, infer _TRecordTypeId>
    ? TTargetTypeId extends TObjects[number]["id"] | RootType["id"]
      ? TProperty
      : Omit<TProperty, "_Type"> & {
          readonly _Type?: RecordIds<
            InterfaceImplementerId<TObjects, TTargetTypeId>
          >
        }
    : TProperty

type BoundProperties<
  TProperties extends ObjectDefinition["properties"],
  TObjects extends ReadonlyArray<ObjectType>,
> = {
  readonly [TKey in keyof TProperties]: BoundProperty<
    TProperties[TKey],
    TObjects
  >
}

type BoundDefinition<
  D extends ObjectDefinition,
  TObjects extends ReadonlyArray<ObjectType>,
> = {
  readonly [TKey in keyof D]: TKey extends "properties"
    ? BoundProperties<D[TKey], TObjects>
    : D[TKey]
}

/** The same object re-derived from a definition whose interface references are bound to the model. */
type BoundObject<
  TObject extends ObjectType,
  TObjects extends ReadonlyArray<ObjectType>,
> =
  TObject extends ObjectType<infer D>
    ? BoundDefinition<D, TObjects> extends infer TBound extends ObjectDefinition
      ? ObjectType<TBound>
      : never
    : never

type ObjectRegistry<TObjects extends ReadonlyArray<ObjectType>> = {
  readonly [TObject in TObjects[number] as TObject["id"]]: BoundObject<
    TObject,
    TObjects
  >
}

type LinkRegistry<TLinks extends ReadonlyArray<LinkType>> = {
  readonly [TLink in TLinks[number] as TLink["id"]]: TLink
}

type InterfaceRegistry<TInterfaces extends ReadonlyArray<InterfaceType>> = {
  readonly [TInterface in TInterfaces[number] as TInterface["id"]]: TInterface
}

type ActionRegistry<TObjects extends ReadonlyArray<ObjectType>> = {
  readonly [TObject in TObjects[number] as TObject["id"]]: TObject["actions"]
}

type QueryRegistry<TObjects extends ReadonlyArray<ObjectType>> = {
  readonly [
    TObject in TObjects[number] as TObject["id"]
  ]: StandardQueries<TObject> & TObject["queries"]
}

type ModuleInterfaces<TModules extends ReadonlyArray<ModuleDefinition>> =
  ReadonlyArray<CoreInterface | TModules[number]["interfaces"][number]>

type ModuleLinks<TModules extends ReadonlyArray<ModuleDefinition>> =
  ReadonlyArray<TModules[number]["links"][number]>

type ModuleObjects<TModules extends ReadonlyArray<ModuleDefinition>> =
  ReadonlyArray<TModules[number]["objects"][number]>

type ModuleRegistry<TModules extends ReadonlyArray<ModuleDefinition>> = {
  readonly [TModule in TModules[number] as TModule["id"]]: TModule
}

declare const modelTypes: unique symbol

export interface ModelCatalog {
  readonly [modelTypes]?: {
    readonly links: ReadonlyArray<LinkType>
    readonly interfaces: ReadonlyArray<InterfaceType>
    readonly objects: ReadonlyArray<ObjectType>
  }
  actions: Readonly<Record<string, Readonly<Record<string, Action>>>>
  /** Interface implemented by records allowed to appear in audit actor fields. */
  actor: typeof Actor
  interfaces: Readonly<Record<string, InterfaceType>>
  kind: "model"
  links: Readonly<Record<string, LinkType>>
  modules: Readonly<Record<string, ModuleDefinition>>
  name: string
  objects: Readonly<Record<string, ObjectType>>
  queries: Readonly<
    Record<string, Readonly<Record<string, Query | CustomQuery>>>
  >
  root: RootType
}

/** A composed model; the registries derive from its module tuple, and `ModelCatalog` is its open form. */
export interface Model<
  TModules extends ReadonlyArray<ModuleDefinition> =
    ReadonlyArray<ModuleDefinition>,
> {
  readonly [modelTypes]?: {
    readonly links: ModuleLinks<TModules>
    readonly interfaces: ModuleInterfaces<TModules>
    readonly objects: ReadonlyArray<
      BoundObject<ModuleObjects<TModules>[number], ModuleObjects<TModules>>
    >
  }
  actions: ActionRegistry<ModuleObjects<TModules>>
  actor: typeof Actor
  interfaces: InterfaceRegistry<ModuleInterfaces<TModules>>
  kind: "model"
  links: LinkRegistry<ModuleLinks<TModules>>
  modules: ModuleRegistry<TModules>
  name: string
  objects: ObjectRegistry<ModuleObjects<TModules>>
  queries: QueryRegistry<ModuleObjects<TModules>>
  root: RootType
}

export type ModelObject<TModel extends ModelCatalog> = NonNullable<
  TModel[typeof modelTypes]
>["objects"][number]

type ModelInterfaceObjectTypeId<
  TModel extends ModelCatalog,
  TInterfaceId extends string,
> =
  ModelObject<TModel> extends infer TObject
    ? TObject extends ObjectType
      ? TInterfaceId extends keyof TObject["interfaces"]
        ? TObject["id"]
        : never
      : never
    : never

type InterfaceRecordId<
  TModel extends ModelCatalog,
  TInterfaceId extends keyof TModel["interfaces"] & string,
> = RecordIds<
  | ModelInterfaceObjectTypeId<TModel, TInterfaceId>
  | RootImplements<TInterfaceId>
>

/** Canonical record ID represented by an object or by any implementer of an interface. */
export type RecordIdOf<
  TModel extends ModelCatalog,
  TType extends InterfaceType | ObjectType,
> = TType["kind"] extends "interface"
  ? TType["id"] extends keyof TModel["interfaces"] & string
    ? InterfaceRecordId<TModel, TType["id"]>
    : never
  : TType["id"] extends keyof TModel["objects"] & string
    ? RecordId<TType["id"]>
    : never

/** A discriminated record reference for any object registered in a model. */
export type ModelObjectRef<TModel extends ModelCatalog> = ObjectRef<
  ModelObject<TModel>["id"]
>

/** Concrete object discriminator represented by one Link endpoint. */
export type ModelEndpointObjectTypeId<
  TModel extends ModelCatalog,
  TEndpoint extends LinkType["forward"]["from"],
> = TEndpoint["kind"] extends "object"
  ? TEndpoint["typeId"] & (ModelObject<TModel>["id"] | RootType["id"])
  : TEndpoint["typeId"] extends keyof TModel["interfaces"] & string
    ?
        | ModelInterfaceObjectTypeId<TModel, TEndpoint["typeId"]>
        | RootImplements<TEndpoint["typeId"]>
    : never

export type LinkDirection = "forward" | "reverse"

/** One Link traversal projected onto a concrete object that can own an API route. */
export interface ModelLinkTraversal {
  readonly direction: LinkDirection
  /** Whether standard create may establish this traversal atomically. */
  readonly link: LinkType
  readonly source: ObjectType
  readonly traversal: LinkType[LinkDirection]
  readonly target: LinkType[LinkDirection]
  readonly writable: boolean
}

type SelectModules<
  TModules extends ReadonlyArray<ModuleDefinition>,
  TIds extends string,
> = TModules extends readonly [
  infer THead extends ModuleDefinition,
  ...infer TRest extends ReadonlyArray<ModuleDefinition>,
]
  ? THead["id"] extends TIds
    ? readonly [THead, ...SelectModules<TRest, TIds>]
    : SelectModules<TRest, TIds>
  : readonly []

/**
 * Narrows a composed model to the listed modules for the UI and API. Storage and
 * migrations keep using the complete model, so disabling a module hides its
 * operations without touching its data. Returns the same instance when every
 * module is enabled. Fails when a listed module is unknown or when an enabled
 * module references types or links owned by a module that is not listed.
 */
export function enableModules<
  const TModules extends ReadonlyArray<ModuleDefinition>,
  const TIds extends ReadonlyArray<TModules[number]["id"]>,
>(
  model: Model<TModules>,
  enabled: TIds
): Model<SelectModules<TModules, TIds[number]>> {
  const composed: ReadonlyArray<ModuleDefinition> = Object.values(model.modules)
  const unknown = enabled.filter((id) => !Object.hasOwn(model.modules, id))
  if (unknown.length > 0)
    throw new Error(
      `Unknown enabled module '${unknown[0]}'. Composed modules: ${composed
        .map((module) => module.id)
        .join(", ")}.`
    )
  const ids = new Set<string>(enabled)
  const modules = composed.filter((module) => ids.has(module.id))
  if (modules.length === composed.length) return model
  assertModulesClosed(modules, composed)
  // SAFETY: the enabled module list is a subset of the composed tuple, so the
  // narrowed registries are exactly the ones defineModel derives from that subset.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return defineModel({ modules, name: model.name }) as unknown as Model<
    SelectModules<TModules, TIds[number]>
  >
}

/** Closes, validates, and indexes a portable model over the kernel Root and Actor. */
export function defineModel<
  const TModules extends ReadonlyArray<ModuleDefinition>,
>(definition: { modules: TModules; name: string }): Model<TModules> {
  const moduleInterfaces: ReadonlyArray<InterfaceType> = [
    ...coreInterfaces,
    ...definition.modules.flatMap((module) => module.interfaces),
  ]
  const moduleLinks = definition.modules.flatMap((module) => module.links)
  const moduleObjects = definition.modules.flatMap((module) => module.objects)
  assertModelDefinitionsValid({
    interfaces: moduleInterfaces,
    links: moduleLinks,
    modules: definition.modules,
    name: definition.name,
    objects: moduleObjects,
  })

  const objects = Object.fromEntries(
    moduleObjects.map((object) => [object.id, object])
  )
  const links = Object.fromEntries(moduleLinks.map((link) => [link.id, link]))
  const interfaces = Object.fromEntries(
    moduleInterfaces.map((item) => [item.id, item])
  )
  const actions = Object.fromEntries(
    moduleObjects.map((object) => [object.id, object.actions])
  )
  const queries = Object.fromEntries(
    moduleObjects.map((object) => [
      object.id,
      { ...standardQueries(object), ...object.queries },
    ])
  )
  const modules = Object.fromEntries(
    definition.modules.map((module) => [module.id, module])
  )
  const catalog: ModelCatalog = {
    actions,
    actor: Actor,
    interfaces,
    kind: "model",
    links,
    modules,
    name: definition.name,
    objects,
    queries,
    root: Root,
  }
  assertRelationshipNamesUnambiguous(moduleObjects, modelRelationships(catalog))

  // SAFETY: duplicate identifiers were rejected before building the registries.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return catalog as unknown as Model<TModules>
}

export function modelActions(model: ModelCatalog): ReadonlyArray<Action> {
  return Object.values(model.actions).flatMap((group) => Object.values(group))
}

export function modelQueries(
  model: ModelCatalog
): ReadonlyArray<Query | CustomQuery> {
  return Object.values(model.queries).flatMap((group) => Object.values(group))
}

/** Whether a concrete stored object type is the expected type or implements it. */
export function modelTypeAccepts(
  model: ModelCatalog,
  actualObjectType: string,
  expectedTypeId: string
): boolean {
  if (actualObjectType === expectedTypeId) return true
  if (actualObjectType === model.root.id) {
    return Object.hasOwn(model.root.interfaces, expectedTypeId)
  }
  const object = model.objects[actualObjectType]
  return (
    object !== undefined && Object.hasOwn(object.interfaces, expectedTypeId)
  )
}

export function modelLinks(model: ModelCatalog): ReadonlyArray<LinkType> {
  return Object.values(model.links)
}

/** Expands interface endpoints onto each concrete implementing object. */
export function modelObjectLinkTraversals(
  model: ModelCatalog,
  object: ObjectType
): ReadonlyArray<ModelLinkTraversal> {
  return modelLinks(model).flatMap((link) =>
    (["forward", "reverse"] as const).flatMap((direction) => {
      const traversal = link[direction]
      if (!modelTypeAccepts(model, object.id, traversal.from.typeId)) return []
      const opposite = direction === "forward" ? "reverse" : "forward"
      return [
        {
          direction,
          link,
          source: object,
          target: link[opposite],
          traversal,
          writable: link.writeFrom === traversal.key,
        },
      ]
    })
  )
}

export function modelModules(
  model: ModelCatalog
): ReadonlyArray<ModuleDefinition> {
  return Object.values(model.modules)
}

export function modelInterfaces(
  model: ModelCatalog
): ReadonlyArray<InterfaceType> {
  return Object.values(model.interfaces)
}

export function modelObjects(model: ModelCatalog): ReadonlyArray<ObjectType> {
  return Object.values(model.objects)
}
