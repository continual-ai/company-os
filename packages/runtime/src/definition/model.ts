import { type Action, actionKey, isStandardActionId } from "./action"
import type { InterfaceType } from "./interface"
import type { LinkTraversal, LinkType } from "./link"
import type { ModuleDefinition } from "./module"
import type {
  ObjectCreateInput,
  ObjectRef,
  ObjectType,
  ObjectUpdateInput,
} from "./object"
import { standardQueries, type Query, type StandardQueries } from "./query"
import type { RootType } from "./root"
import type {
  AnySchema,
  RecordAlias,
  RecordId,
  RecordIdSchema,
  RecordIdentifier,
} from "./schema"

type InterfaceImplementerId<
  TObjects extends ReadonlyArray<ObjectType>,
  TRoot extends RootType,
  TInterfaceId extends string,
> =
  | InterfaceImplementerIdFor<TObjects[number], TInterfaceId>
  | (TInterfaceId extends keyof TRoot["interfaces"] ? TRoot["id"] : never)

type InterfaceImplementerIdFor<
  TObject,
  TInterfaceId extends string,
> = TObject extends ObjectType
  ? TInterfaceId extends keyof TObject["interfaces"]
    ? TObject["id"]
    : never
  : never

type BoundProperty<
  TProperty,
  TObjects extends ReadonlyArray<ObjectType>,
  TRoot extends RootType,
> =
  TProperty extends RecordIdSchema<infer TTargetTypeId, infer _TRecordTypeId>
    ? TTargetTypeId extends TObjects[number]["id"] | TRoot["id"]
      ? TProperty
      : Omit<TProperty, "_Type" | "_Value"> & {
          readonly _Type?: RecordIds<
            InterfaceImplementerId<TObjects, TRoot, TTargetTypeId>
          >
          readonly _Value?: RecordIds<
            InterfaceImplementerId<TObjects, TRoot, TTargetTypeId>
          >
        }
    : TProperty

type BoundProperties<
  TProperties extends ObjectType["properties"],
  TObjects extends ReadonlyArray<ObjectType>,
  TRoot extends RootType,
> = {
  readonly [TKey in keyof TProperties]: BoundProperty<
    TProperties[TKey],
    TObjects,
    TRoot
  >
}

type BoundObject<
  TObject extends ObjectType,
  TObjects extends ReadonlyArray<ObjectType>,
  TRoot extends RootType,
  TActor extends InterfaceType,
> =
  TObject extends ObjectType<
    infer TId,
    infer TCollection,
    infer TProperties,
    infer TActions,
    infer TParentTypeId,
    infer TParentKind,
    infer TParentRecordTypeId,
    infer TInterfaces,
    infer _TActorRecordTypeId
  >
    ? ObjectType<
        TId,
        TCollection,
        BoundProperties<TProperties, TObjects, TRoot>,
        TActions,
        TParentTypeId,
        TParentKind,
        TParentKind extends "interface"
          ? InterfaceImplementerId<TObjects, TRoot, TParentTypeId>
          : TParentRecordTypeId,
        TInterfaces,
        InterfaceImplementerId<TObjects, TRoot, TActor["id"]>
      >
    : never

type ObjectRegistry<
  TObjects extends ReadonlyArray<ObjectType>,
  TRoot extends RootType,
  TActor extends InterfaceType,
> = {
  readonly [TObject in TObjects[number] as TObject["id"]]: BoundObject<
    TObject,
    TObjects,
    TRoot,
    TActor
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
  ]: StandardQueries<TObject>
}

type ModuleInterfaces<TModules extends ReadonlyArray<ModuleDefinition>> =
  ReadonlyArray<TModules[number]["interfaces"][number]>

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
  actor: InterfaceType
  interfaces: Readonly<Record<string, InterfaceType>>
  kind: "model"
  links: Readonly<Record<string, LinkType>>
  modules: Readonly<Record<string, ModuleDefinition>>
  name: string
  objects: Readonly<Record<string, ObjectType>>
  queries: Readonly<Record<string, Readonly<Record<string, Query>>>>
  root: RootType
}

export interface Model<
  TRoot extends RootType = RootType,
  TModules extends ReadonlyArray<ModuleDefinition> =
    ReadonlyArray<ModuleDefinition>,
  TObjects extends ReadonlyArray<ObjectType> = ReadonlyArray<ObjectType>,
  TLinks extends ReadonlyArray<LinkType> = ReadonlyArray<LinkType>,
  TInterfaces extends ReadonlyArray<InterfaceType> =
    ReadonlyArray<InterfaceType>,
  TActor extends InterfaceType = InterfaceType,
> {
  readonly [modelTypes]?: {
    readonly links: TLinks
    readonly interfaces: TInterfaces
    readonly objects: ReadonlyArray<
      BoundObject<TObjects[number], TObjects, TRoot, TActor>
    >
  }
  actions: ActionRegistry<TObjects>
  actor: TActor
  interfaces: InterfaceRegistry<TInterfaces>
  kind: "model"
  links: LinkRegistry<TLinks>
  modules: ModuleRegistry<TModules>
  name: string
  objects: ObjectRegistry<TObjects, TRoot, TActor>
  queries: QueryRegistry<TObjects>
  root: TRoot
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

type RecordIds<TTypeId extends string> = TTypeId extends string
  ? RecordId<TTypeId>
  : never

type InterfaceRecordId<
  TModel extends ModelCatalog,
  TInterfaceId extends keyof TModel["interfaces"] & string,
> = RecordIds<
  | ModelInterfaceObjectTypeId<TModel, TInterfaceId>
  | (TInterfaceId extends keyof TModel["root"]["interfaces"]
      ? TModel["root"]["id"]
      : never)
>

/** Canonical record ID represented by an object, interface, or model root. */
export type RecordIdOf<
  TModel extends ModelCatalog,
  TType extends InterfaceType | ObjectType | RootType,
> = TType["kind"] extends "interface"
  ? TType["id"] extends keyof TModel["interfaces"] & string
    ? InterfaceRecordId<TModel, TType["id"]>
    : never
  : TType["kind"] extends "object"
    ? TType["id"] extends keyof TModel["objects"] & string
      ? RecordId<TType["id"]>
      : never
    : TType["id"] extends TModel["root"]["id"]
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
  ? TEndpoint["typeId"] & (ModelObject<TModel>["id"] | TModel["root"]["id"])
  : TEndpoint["typeId"] extends keyof TModel["interfaces"] & string
    ?
        | ModelInterfaceObjectTypeId<TModel, TEndpoint["typeId"]>
        | (TEndpoint["typeId"] extends keyof TModel["root"]["interfaces"]
            ? TModel["root"]["id"]
            : never)
    : never

type EndpointIdentifier<
  TModel extends ModelCatalog,
  TEndpoint extends LinkType["forward"]["from"],
> = TEndpoint["kind"] extends "interface"
  ? TEndpoint["typeId"] extends keyof TModel["interfaces"] & string
    ?
        | RecordIdOf<TModel, TModel["interfaces"][TEndpoint["typeId"]]>
        | RecordAlias
    : never
  : RecordIdentifier<TEndpoint["typeId"]>

type ObjectAcceptsEndpoint<
  TObject extends ObjectType,
  TEndpoint extends LinkType["forward"]["from"],
> = TEndpoint["kind"] extends "object"
  ? TEndpoint["typeId"] extends TObject["id"]
    ? true
    : false
  : TEndpoint["typeId"] extends keyof TObject["interfaces"]
    ? true
    : false

type LinkSideForObject<TObject extends ObjectType, TLink> =
  TLink extends LinkType<string, infer TForward, infer TReverse>
    ?
        | (ObjectAcceptsEndpoint<TObject, TForward["from"]> extends true
            ? {
                readonly link: TLink
                readonly side: TForward
                readonly target: TReverse
              }
            : never)
        | (ObjectAcceptsEndpoint<TObject, TReverse["from"]> extends true
            ? {
                readonly link: TLink
                readonly side: TReverse
                readonly target: TForward
              }
            : never)
    : never

type ModelLinkSide<
  TModel extends ModelCatalog,
  TObject extends ObjectType,
> = TModel["links"][keyof TModel["links"]] extends infer TLink
  ? LinkSideForObject<TObject, TLink>
  : never

type InitialLinkSide<TSide> = TSide extends {
  readonly link: infer TLink extends LinkType
  readonly side: infer TTraversal extends LinkTraversal
}
  ? TTraversal["cardinality"] extends "many"
    ? TLink["writeFrom"] extends TTraversal["key"]
      ? TSide
      : never
    : TSide
  : never

type InitialLinkValue<
  TModel extends ModelCatalog,
  TSide extends LinkTraversal,
  TTarget extends LinkTraversal,
> = TSide["cardinality"] extends "many"
  ? ReadonlyArray<EndpointIdentifier<TModel, TTarget["from"]>>
  : EndpointIdentifier<TModel, TTarget["from"]>

type RequiredInitialLinks<
  TModel extends ModelCatalog,
  TObject extends ObjectType,
> = {
  readonly [
    TSide in InitialLinkSide<
      ModelLinkSide<TModel, TObject>
    > as TSide["side"]["cardinality"] extends "one"
      ? TSide["side"]["key"]
      : never
  ]: InitialLinkValue<TModel, TSide["side"], TSide["target"]>
}

type OptionalInitialLinks<
  TModel extends ModelCatalog,
  TObject extends ObjectType,
> = {
  readonly [
    TSide in InitialLinkSide<
      ModelLinkSide<TModel, TObject>
    > as TSide["side"]["cardinality"] extends "one"
      ? never
      : TSide["side"]["key"]
  ]?: InitialLinkValue<TModel, TSide["side"], TSide["target"]>
}

type InitialLinksFor<
  TModel extends ModelCatalog,
  TObject extends ObjectType,
> = RequiredInitialLinks<TModel, TObject> &
  OptionalInitialLinks<TModel, TObject>

/** Standard create input plus the object's model-derived initial Links. */
export type ModelObjectCreateInput<
  TModel extends ModelCatalog,
  TObject extends ModelObject<TModel>,
> = ObjectCreateInput<TObject> &
  (keyof RequiredInitialLinks<TModel, TObject> extends never
    ? { readonly links?: InitialLinksFor<TModel, TObject> }
    : { readonly links: InitialLinksFor<TModel, TObject> })

type WritableLinkSide<TSide> = TSide extends {
  readonly link: infer TLink extends LinkType
  readonly side: infer TTraversal extends LinkTraversal
}
  ? TLink["writeFrom"] extends TTraversal["key"]
    ? TSide
    : never
  : never

type CanUnlink<
  TSide extends LinkTraversal,
  TTarget extends LinkTraversal,
> = TSide["cardinality"] extends "one"
  ? false
  : TTarget["cardinality"] extends "one"
    ? false
    : true

type LinkChangesFor<
  TModel extends ModelCatalog,
  TSide extends LinkTraversal,
  TTarget extends LinkTraversal,
> = {
  readonly add?: ReadonlyArray<EndpointIdentifier<TModel, TTarget["from"]>>
} & (CanUnlink<TSide, TTarget> extends true
  ? {
      readonly remove?: ReadonlyArray<
        EndpointIdentifier<TModel, TTarget["from"]>
      >
    }
  : object)

type UpdateLinksFor<TModel extends ModelCatalog, TObject extends ObjectType> = {
  readonly [
    TSide in WritableLinkSide<
      ModelLinkSide<TModel, TObject>
    > as TSide["side"]["key"]
  ]?: LinkChangesFor<TModel, TSide["side"], TSide["target"]>
}

/** Standard update input plus atomic deltas for writable model Links. */
export type ModelObjectUpdateInput<
  TModel extends ModelCatalog,
  TObject extends ModelObject<TModel>,
> = ObjectUpdateInput<TObject> & {
  readonly links?: UpdateLinksFor<TModel, TObject>
}

export type LinkDirection = "forward" | "reverse"

/** One Link traversal projected onto a concrete object that can own an API route. */
export interface ModelLinkTraversal {
  readonly direction: LinkDirection
  /** Whether standard create may establish this traversal atomically. */
  readonly initializable: boolean
  readonly link: LinkType
  readonly source: ObjectType
  readonly traversal: LinkType[LinkDirection]
  readonly target: LinkType[LinkDirection]
  readonly writable: boolean
}

function referencedTypeIds(definition: AnySchema): ReadonlyArray<string> {
  switch (definition.kind) {
    case "array":
      return referencedTypeIds(definition.items)
    case "map":
      return referencedTypeIds(definition.values)
    case "optional":
      return referencedTypeIds(definition.value)
    case "recordId":
      return [definition.typeId]
    case "struct":
      return Object.values(definition.properties).flatMap(referencedTypeIds)
    case "union":
      return definition.members.flatMap(referencedTypeIds)
    default:
      return []
  }
}

function assertReferencesRegistered(
  owner: string,
  schemas: ReadonlyArray<AnySchema>,
  registeredTypeIds: ReadonlySet<string>,
  modelName: string
): void {
  for (const referencedId of schemas.flatMap(referencedTypeIds)) {
    if (!registeredTypeIds.has(referencedId)) {
      throw new Error(
        `${owner} references type '${referencedId}', which is not registered in model '${modelName}'.`
      )
    }
  }
}

function duplicateValue(values: ReadonlyArray<string>): string | undefined {
  return values.find((value, index) => values.indexOf(value) !== index)
}

const generatedQueryMethodIds = new Set(["batchGet", "get", "list", "search"])

/** Closes, validates, and indexes a portable model. */
export function defineModel<
  const TRoot extends RootType,
  const TModules extends ReadonlyArray<ModuleDefinition>,
  const TActor extends ModuleInterfaces<TModules>[number],
>(definition: {
  actor: TActor
  modules: TModules
  name: string
  root: TRoot
}): Model<
  TRoot,
  TModules,
  ModuleObjects<TModules>,
  ModuleLinks<TModules>,
  ModuleInterfaces<TModules>,
  TActor
> {
  const moduleIds = definition.modules.map((module) => module.id)
  const duplicateModule = duplicateValue(moduleIds)
  if (duplicateModule !== undefined) {
    throw new Error(
      `Module id '${duplicateModule}' is registered more than once.`
    )
  }

  const moduleInterfaces = definition.modules.flatMap(
    (module) => module.interfaces
  )
  const moduleLinks = definition.modules.flatMap((module) => module.links)
  const moduleObjects = definition.modules.flatMap((module) => module.objects)
  const objectTypeIds = moduleObjects.map((object) => object.id)
  const duplicateObject = duplicateValue(objectTypeIds)
  if (duplicateObject !== undefined) {
    throw new Error(
      `Object id '${duplicateObject}' is registered more than once.`
    )
  }

  const collections = moduleObjects.map((object) => object.collection)
  const duplicateCollection = duplicateValue(collections)
  if (duplicateCollection !== undefined) {
    throw new Error(
      `Object collection '${duplicateCollection}' is registered more than once.`
    )
  }

  const linkIds = moduleLinks.map((link) => link.id)
  const duplicateLink = duplicateValue(linkIds)
  if (duplicateLink !== undefined) {
    throw new Error(`Link id '${duplicateLink}' is registered more than once.`)
  }

  const interfaceDefinitions = moduleInterfaces
  const interfaceIds = interfaceDefinitions.map((item) => item.id)
  const duplicateInterface = duplicateValue(interfaceIds)
  if (duplicateInterface !== undefined) {
    throw new Error(
      `Interface id '${duplicateInterface}' is registered more than once.`
    )
  }
  const typeCollision = interfaceIds.find((id) => objectTypeIds.includes(id))
  if (typeCollision !== undefined) {
    throw new Error(
      `Type id '${typeCollision}' is shared by an object and interface.`
    )
  }
  if (!interfaceIds.includes(definition.actor.id)) {
    throw new Error(
      `Actor interface '${definition.actor.id}' is not registered in model '${definition.name}'.`
    )
  }

  if (
    objectTypeIds.includes(definition.root.id) ||
    interfaceIds.includes(definition.root.id)
  ) {
    throw new Error(
      `Root id '${definition.root.id}' must be unique within model '${definition.name}'.`
    )
  }

  const registeredObjectTypeIds = new Set(objectTypeIds)
  const registeredTypeIds = new Set([
    definition.root.id,
    ...objectTypeIds,
    ...interfaceIds,
  ])
  for (const implementation of Object.values(definition.root.interfaces)) {
    if (!interfaceIds.includes(implementation.interfaceId)) {
      throw new Error(
        `Root '${definition.root.id}' implements interface '${implementation.interfaceId}', which is not registered in model '${definition.name}'.`
      )
    }
  }
  for (const object of moduleObjects) {
    const parentRegistered =
      (object.parent.kind === "root" &&
        object.parent.typeId === definition.root.id) ||
      (object.parent.kind === "object" &&
        registeredObjectTypeIds.has(object.parent.typeId)) ||
      (object.parent.kind === "interface" &&
        interfaceIds.includes(object.parent.typeId))
    if (!parentRegistered) {
      throw new Error(
        `Object '${object.id}' parent type '${object.parent.typeId}' is not registered as ${object.parent.kind} in model '${definition.name}'.`
      )
    }
    for (const [propertyId, property] of Object.entries(object.properties)) {
      assertReferencesRegistered(
        `Object '${object.id}' property '${propertyId}'`,
        [property],
        registeredTypeIds,
        definition.name
      )
    }
    for (const implementation of Object.values(object.interfaces)) {
      if (!interfaceIds.includes(implementation.interfaceId)) {
        throw new Error(
          `Object '${object.id}' implements interface '${implementation.interfaceId}', which is not registered in model '${definition.name}'.`
        )
      }
    }
    for (const action of Object.values(object.actions)) {
      if (
        !isStandardActionId(action.id) &&
        generatedQueryMethodIds.has(action.id)
      ) {
        throw new Error(
          `Action '${actionKey(action)}' conflicts with a generated Query method.`
        )
      }
      assertReferencesRegistered(
        `Action '${actionKey(action)}'`,
        [action.input, action.output],
        registeredTypeIds,
        definition.name
      )
    }
  }
  const actorInterfaceId = definition.actor.id
  const hasActor =
    Object.hasOwn(definition.root.interfaces, actorInterfaceId) ||
    moduleObjects.some((object) =>
      Object.hasOwn(object.interfaces, actorInterfaceId)
    )
  if (!hasActor) {
    throw new Error(
      `Actor interface '${actorInterfaceId}' has no implementer in model '${definition.name}'.`
    )
  }

  const objectsById = new Map(
    moduleObjects.map((object) => [object.id, object])
  )
  for (const object of moduleObjects) {
    const ancestry = new Set([object.id])
    let parent = object.parent
    while (parent.kind === "object") {
      if (ancestry.has(parent.typeId)) {
        throw new Error(
          `Object '${object.id}' has a cyclic parent hierarchy in model '${definition.name}'.`
        )
      }
      ancestry.add(parent.typeId)
      const parentObject = objectsById.get(parent.typeId)
      if (parentObject === undefined) break
      parent = parentObject.parent
    }
  }

  for (const link of moduleLinks) {
    for (const traversal of [link.forward, link.reverse]) {
      const endpoint = traversal.from
      if (!registeredTypeIds.has(endpoint.typeId)) {
        throw new Error(
          `Link '${link.id}' references type '${endpoint.typeId}', which is not registered in model '${definition.name}'.`
        )
      }
      const expectedKind = objectsById.has(endpoint.typeId)
        ? "object"
        : interfaceIds.includes(endpoint.typeId)
          ? "interface"
          : undefined
      if (expectedKind !== undefined && endpoint.kind !== expectedKind) {
        throw new Error(
          `Link '${link.id}' type '${endpoint.typeId}' changed kind after the link was defined.`
        )
      }
      const object = objectsById.get(endpoint.typeId)
      if (
        object !== undefined &&
        Object.hasOwn(object.properties, traversal.key)
      ) {
        throw new Error(
          `Link '${link.id}' traversal '${endpoint.typeId}.${traversal.key}' conflicts with an object property.`
        )
      }
      const interfaceType = interfaceDefinitions.find(
        (item) => item.id === endpoint.typeId
      )
      if (
        interfaceType !== undefined &&
        Object.hasOwn(interfaceType.properties, traversal.key)
      ) {
        throw new Error(
          `Link '${link.id}' traversal '${endpoint.typeId}.${traversal.key}' conflicts with an interface property.`
        )
      }
    }
  }

  const linkMethods = moduleLinks.flatMap((link) => [
    `${link.forward.from.typeId}.${link.forward.key}`,
    `${link.reverse.from.typeId}.${link.reverse.key}`,
  ])
  const duplicateLinkMethod = duplicateValue(linkMethods)
  if (duplicateLinkMethod !== undefined) {
    throw new Error(
      `Link traversal '${duplicateLinkMethod}' is registered more than once in model '${definition.name}'.`
    )
  }
  for (const object of moduleObjects) {
    const traversals = moduleLinks.flatMap((link) =>
      [link.forward, link.reverse].filter(
        ({ from }) =>
          (from.kind === "object" && from.typeId === object.id) ||
          (from.kind === "interface" &&
            Object.hasOwn(object.interfaces, from.typeId))
      )
    )
    const duplicateTraversal = duplicateValue(traversals.map(({ key }) => key))
    if (duplicateTraversal !== undefined) {
      throw new Error(
        `Object '${object.id}' receives Link traversal '${duplicateTraversal}' more than once in model '${definition.name}'.`
      )
    }
    const propertyConflict = traversals.find(({ key }) =>
      Object.hasOwn(object.properties, key)
    )
    if (propertyConflict !== undefined) {
      throw new Error(
        `Link traversal '${object.id}.${propertyConflict.key}' conflicts with an object property.`
      )
    }
    const methodIds = new Set([
      ...generatedQueryMethodIds,
      ...Object.keys(object.actions),
    ])
    const methodConflict = traversals.find(({ key }) => methodIds.has(key))
    if (methodConflict !== undefined) {
      throw new Error(
        `Link traversal '${object.id}.${methodConflict.key}' conflicts with a generated Query or Action method.`
      )
    }
  }

  const objects = Object.fromEntries(
    moduleObjects.map((object) => [object.id, object])
  )
  for (const object of Object.values(objects)) {
    for (const [ruleId, fields] of Object.entries(object.uniqueBy)) {
      for (const field of fields) {
        if (field !== "parent" && !Object.hasOwn(object.properties, field)) {
          throw new Error(
            `Object '${object.id}' unique rule '${ruleId}' references unknown field '${field}'.`
          )
        }
      }
    }
  }
  const links = Object.fromEntries(moduleLinks.map((link) => [link.id, link]))
  const interfaces = Object.fromEntries(
    interfaceDefinitions.map((item) => [item.id, item])
  )
  const actions = Object.fromEntries(
    Object.values(objects).map((object) => [object.id, object.actions])
  )
  const queries = Object.fromEntries(
    Object.values(objects).map((object) => [object.id, standardQueries(object)])
  )
  const modules = Object.fromEntries(
    definition.modules.map((module) => [module.id, module])
  )

  // SAFETY: duplicate identifiers were rejected before building the registries.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return {
    actions,
    actor: definition.actor,
    interfaces,
    kind: "model",
    links,
    modules,
    name: definition.name,
    objects,
    queries,
    root: definition.root,
  } as unknown as Model<
    TRoot,
    TModules,
    ModuleObjects<TModules>,
    ModuleLinks<TModules>,
    ModuleInterfaces<TModules>,
    TActor
  >
}

export function modelActions(model: ModelCatalog): ReadonlyArray<Action> {
  return Object.values(model.actions).flatMap((group) => Object.values(group))
}

export function modelQueries(model: ModelCatalog): ReadonlyArray<Query> {
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
          initializable:
            traversal.cardinality !== "many" ||
            link.writeFrom === traversal.key,
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
