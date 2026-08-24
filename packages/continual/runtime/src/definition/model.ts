import {
  type Action,
  actionKey,
  isStandardActionId,
  standardActions,
} from "./action"
import { definitionId } from "./identity"
import type { InterfaceType } from "./interface"
import {
  linkReferenceTraversals,
  type LinkCardinality,
  type LinkTraversal,
  type LinkType,
} from "./link"
import type { ObjectRef, ObjectType } from "./object"
import { normalizeProperties, type Properties } from "./property"
import type { RootType } from "./root"
import {
  schema,
  type AnySchema,
  type InferSchema,
  type RecordId,
  type RecordIdSchema,
} from "./schema"

type Simplify<TValue> = { [TKey in keyof TValue]: TValue[TKey] } & {}

type LinkReferenceProperty<
  TTargetTypeId extends string,
  TRecordTypeId extends string,
  TCardinality extends Exclude<LinkCardinality, "many">,
> = RecordIdSchema<TTargetTypeId, TRecordTypeId> & {
  readonly _Value?: InferSchema<RecordIdSchema<TTargetTypeId, TRecordTypeId>>
  immutable: false
  nullable: TCardinality extends "zeroOrOne" ? true : false
  outputOnly: false
  requiredOnCreate: TCardinality extends "one" ? true : false
}

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

type LinkTargetRecordId<
  TTarget extends LinkTraversal,
  TObjects extends ReadonlyArray<ObjectType>,
  TRoot extends RootType,
> = TTarget["from"]["kind"] extends "interface"
  ? InterfaceImplementerId<TObjects, TRoot, TTarget["from"]["typeId"]>
  : TTarget["from"]["typeId"]

type StoredLinkProperty<
  TObjectType extends string,
  TOwner extends LinkTraversal,
  TTarget extends LinkTraversal,
  TObjects extends ReadonlyArray<ObjectType>,
  TRoot extends RootType,
> = TOwner["from"]["typeId"] extends TObjectType
  ? {
      readonly [TKey in TOwner["key"]]: LinkReferenceProperty<
        TTarget["from"]["typeId"],
        LinkTargetRecordId<TTarget, TObjects, TRoot>,
        Exclude<TOwner["cardinality"], "many">
      >
    }
  : object

type LinkPropertyFor<
  TObjectType extends string,
  TLink extends LinkType,
  TObjects extends ReadonlyArray<ObjectType>,
  TRoot extends RootType,
> =
  TLink extends LinkType<string, infer TForward, infer TReverse>
    ? TForward["cardinality"] extends "many"
      ? TReverse["cardinality"] extends "many"
        ? object
        : StoredLinkProperty<TObjectType, TReverse, TForward, TObjects, TRoot>
      : TReverse["cardinality"] extends "many"
        ? StoredLinkProperty<TObjectType, TForward, TReverse, TObjects, TRoot>
        : TForward["from"]["kind"] extends "object"
          ? StoredLinkProperty<TObjectType, TForward, TReverse, TObjects, TRoot>
          : StoredLinkProperty<TObjectType, TReverse, TForward, TObjects, TRoot>
    : object

type UnionToIntersection<TValue> = (
  TValue extends unknown ? (value: TValue) => void : never
) extends (value: infer TIntersection) => void
  ? TIntersection
  : never

type LinkPropertiesFor<
  TObjectType extends string,
  TLinks extends ReadonlyArray<LinkType>,
  TObjects extends ReadonlyArray<ObjectType>,
  TRoot extends RootType,
> = [TLinks[number]] extends [never]
  ? object
  : Simplify<
      UnionToIntersection<
        LinkPropertyFor<TObjectType, TLinks[number], TObjects, TRoot>
      >
    >

type BoundProperties<
  TObjectType extends string,
  TObjectProperties extends Properties,
  TLinks extends ReadonlyArray<LinkType>,
  TObjects extends ReadonlyArray<ObjectType>,
  TRoot extends RootType,
> =
  Simplify<
    TObjectProperties & LinkPropertiesFor<TObjectType, TLinks, TObjects, TRoot>
  > extends infer TResult extends Properties
    ? TResult
    : never

type BoundObject<
  TObject extends ObjectType,
  TLinks extends ReadonlyArray<LinkType>,
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
        BoundProperties<TId, TProperties, TLinks, TObjects, TRoot>,
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
  TLinks extends ReadonlyArray<LinkType>,
  TRoot extends RootType,
  TActor extends InterfaceType,
> = {
  readonly [TObject in TObjects[number] as TObject["id"]]: BoundObject<
    TObject,
    TLinks,
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
  id: string
  interfaces: Readonly<Record<string, InterfaceType>>
  kind: "model"
  links: Readonly<Record<string, LinkType>>
  name: string
  objects: Readonly<Record<string, ObjectType>>
  root: RootType
}

export interface Model<
  TId extends string = string,
  TRoot extends RootType = RootType,
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
      BoundObject<TObjects[number], TLinks, TObjects, TRoot, TActor>
    >
  }
  actions: ActionRegistry<TObjects>
  actor: TActor
  id: TId
  interfaces: InterfaceRegistry<TInterfaces>
  kind: "model"
  links: LinkRegistry<TLinks>
  name: string
  objects: ObjectRegistry<TObjects, TLinks, TRoot, TActor>
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
  modelId: string
): void {
  for (const referencedId of schemas.flatMap(referencedTypeIds)) {
    if (!registeredTypeIds.has(referencedId)) {
      throw new Error(
        `${owner} references type '${referencedId}', which is not registered in model '${modelId}'.`
      )
    }
  }
}

function duplicateValue(values: ReadonlyArray<string>): string | undefined {
  return values.find((value, index) => values.indexOf(value) !== index)
}

interface LinkReferenceOptions {
  description?: string
  label: string
  nullable?: true
}

function bindLinkProperties(
  object: ObjectType,
  links: ReadonlyArray<LinkType>
): ObjectType {
  const generated = Object.fromEntries(
    links.flatMap((link) => {
      const reference = linkReferenceTraversals(link)
      if (
        reference === undefined ||
        reference.source.from.typeId !== object.id
      ) {
        return []
      }

      const propertyId = reference.source.key
      if (Object.hasOwn(object.properties, propertyId)) {
        throw new Error(
          `Object '${object.id}' property '${propertyId}' duplicates link '${link.id}'; the model derives singular link properties automatically.`
        )
      }
      const options: LinkReferenceOptions = { label: reference.source.label }
      if (reference.source.description !== undefined) {
        options.description = reference.source.description
      }
      if (reference.source.cardinality === "zeroOrOne") options.nullable = true
      return [
        [
          propertyId,
          schema.recordId({ id: reference.target.from.typeId }, options),
        ] as const,
      ]
    })
  )
  const properties = {
    ...object.properties,
    ...normalizeProperties(generated),
  }
  const standardSettings = {
    batchDelete: Object.hasOwn(object.actions, "batchDelete"),
    create: Object.hasOwn(object.actions, "create"),
    delete: Object.hasOwn(object.actions, "delete"),
    update: Object.hasOwn(object.actions, "update"),
  }
  const customActions = Object.values(object.actions).filter(
    (action) => !isStandardActionId(action.id)
  )
  const actions = Object.fromEntries(
    [
      ...standardActions({ ...object, properties }, standardSettings),
      ...customActions,
    ].map((action) => [action.id, action])
  )
  return { ...object, actions, properties }
}

/** Closes, validates, and indexes a portable company model. */
export function defineModel<
  const TId extends string,
  const TRoot extends RootType,
  const TObjects extends ReadonlyArray<ObjectType>,
  const TLinks extends ReadonlyArray<LinkType>,
  const TInterfaces extends ReadonlyArray<InterfaceType>,
  const TActor extends TInterfaces[number],
>(definition: {
  actor: TActor
  id: TId
  interfaces: TInterfaces
  links: TLinks
  name: string
  objects: TObjects
  root: TRoot
}): Model<TId, TRoot, TObjects, TLinks, TInterfaces, TActor> {
  const objectTypeIds = definition.objects.map((object) => object.id)
  const duplicateObject = duplicateValue(objectTypeIds)
  if (duplicateObject !== undefined) {
    throw new Error(
      `Object id '${duplicateObject}' is registered more than once.`
    )
  }

  const collections = definition.objects.map((object) => object.collection)
  const duplicateCollection = duplicateValue(collections)
  if (duplicateCollection !== undefined) {
    throw new Error(
      `Object collection '${duplicateCollection}' is registered more than once.`
    )
  }

  const linkIds = definition.links.map((link) => link.id)
  const duplicateLink = duplicateValue(linkIds)
  if (duplicateLink !== undefined) {
    throw new Error(`Link id '${duplicateLink}' is registered more than once.`)
  }

  const interfaceDefinitions = definition.interfaces
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
      `Actor interface '${definition.actor.id}' is not registered in model '${definition.id}'.`
    )
  }

  if (
    objectTypeIds.includes(definition.root.id) ||
    interfaceIds.includes(definition.root.id)
  ) {
    throw new Error(
      `Root id '${definition.root.id}' must be unique within model '${definition.id}'.`
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
        `Root '${definition.root.id}' implements interface '${implementation.interfaceId}', which is not registered in model '${definition.id}'.`
      )
    }
  }
  for (const object of definition.objects) {
    const parentRegistered =
      (object.parent.kind === "root" &&
        object.parent.typeId === definition.root.id) ||
      (object.parent.kind === "object" &&
        registeredObjectTypeIds.has(object.parent.typeId)) ||
      (object.parent.kind === "interface" &&
        interfaceIds.includes(object.parent.typeId))
    if (!parentRegistered) {
      throw new Error(
        `Object '${object.id}' parent type '${object.parent.typeId}' is not registered as ${object.parent.kind} in model '${definition.id}'.`
      )
    }
    for (const [propertyId, property] of Object.entries(object.properties)) {
      assertReferencesRegistered(
        `Object '${object.id}' property '${propertyId}'`,
        [property],
        registeredTypeIds,
        definition.id
      )
    }
    for (const implementation of Object.values(object.interfaces)) {
      if (!interfaceIds.includes(implementation.interfaceId)) {
        throw new Error(
          `Object '${object.id}' implements interface '${implementation.interfaceId}', which is not registered in model '${definition.id}'.`
        )
      }
    }
    for (const action of Object.values(object.actions)) {
      assertReferencesRegistered(
        `Action '${actionKey(action)}'`,
        [action.input, action.output],
        registeredTypeIds,
        definition.id
      )
    }
  }
  const actorInterfaceId = definition.actor.id
  const hasActor =
    Object.hasOwn(definition.root.interfaces, actorInterfaceId) ||
    definition.objects.some((object) =>
      Object.hasOwn(object.interfaces, actorInterfaceId)
    )
  if (!hasActor) {
    throw new Error(
      `Actor interface '${actorInterfaceId}' has no implementer in model '${definition.id}'.`
    )
  }

  const objectsById = new Map(
    definition.objects.map((object) => [object.id, object])
  )
  for (const object of definition.objects) {
    const ancestry = new Set([object.id])
    let parent = object.parent
    while (parent.kind === "object") {
      if (ancestry.has(parent.typeId)) {
        throw new Error(
          `Object '${object.id}' has a cyclic parent hierarchy in model '${definition.id}'.`
        )
      }
      ancestry.add(parent.typeId)
      const parentObject = objectsById.get(parent.typeId)
      if (parentObject === undefined) break
      parent = parentObject.parent
    }
  }

  for (const link of definition.links) {
    const reference = linkReferenceTraversals(link)
    if (
      reference !== undefined &&
      !registeredObjectTypeIds.has(reference.source.from.typeId)
    ) {
      throw new Error(
        `Link '${link.id}' derives its singular '${reference.source.key}' property on interface '${reference.source.from.typeId}'; singular link references must resolve to an object.`
      )
    }
    for (const traversal of [link.forward, link.reverse]) {
      const endpoint = traversal.from
      if (!registeredTypeIds.has(endpoint.typeId)) {
        throw new Error(
          `Link '${link.id}' references type '${endpoint.typeId}', which is not registered in model '${definition.id}'.`
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

  const linkMethods = definition.links.flatMap((link) => [
    `${link.forward.from.typeId}.${link.forward.key}`,
    `${link.reverse.from.typeId}.${link.reverse.key}`,
  ])
  const duplicateLinkMethod = duplicateValue(linkMethods)
  if (duplicateLinkMethod !== undefined) {
    throw new Error(
      `Link traversal '${duplicateLinkMethod}' is registered more than once in model '${definition.id}'.`
    )
  }

  const objects = Object.fromEntries(
    definition.objects.map((object) => [
      object.id,
      bindLinkProperties(object, definition.links),
    ])
  )
  const links = Object.fromEntries(
    definition.links.map((link) => [link.id, link])
  )
  const interfaces = Object.fromEntries(
    interfaceDefinitions.map((item) => [item.id, item])
  )
  const actions = Object.fromEntries(
    Object.values(objects).map((object) => [object.id, object.actions])
  )

  // SAFETY: duplicate identifiers were rejected before building the registries.
  // oxlint-disable-next-line anti-slop/no-chained-type-assertions, typescript/no-unsafe-type-assertion
  return {
    actions,
    actor: definition.actor,
    id: definitionId(definition.id),
    interfaces,
    kind: "model",
    links,
    name: definition.name,
    objects,
    root: definition.root,
  } as unknown as Model<TId, TRoot, TObjects, TLinks, TInterfaces, TActor>
}

export function modelActions(model: ModelCatalog): ReadonlyArray<Action> {
  return Object.values(model.actions).flatMap((group) => Object.values(group))
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

export function modelInterfaces(
  model: ModelCatalog
): ReadonlyArray<InterfaceType> {
  return Object.values(model.interfaces)
}

export function modelObjects(model: ModelCatalog): ReadonlyArray<ObjectType> {
  return Object.values(model.objects)
}
