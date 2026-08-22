import {
  type Action,
  actionKey,
  isStandardActionId,
  standardActions,
} from "./action"
import { definitionId } from "./identity"
import type { InterfaceType } from "./interface"
import type { LinkCardinality, LinkSide, LinkType } from "./link"
import type { ObjectRef, ObjectType } from "./object"
import { normalizeProperties, type Properties } from "./property"
import { Root, type RootType } from "./root"
import { schema, type AnySchema, type RecordIdSchema } from "./schema"

type Simplify<TValue> = { [TKey in keyof TValue]: TValue[TKey] } & {}

type LinkReferenceProperty<
  TTargetTypeId extends string,
  TCardinality extends Exclude<LinkCardinality, "many">,
> = RecordIdSchema<TTargetTypeId> & {
  immutable: false
  nullable: TCardinality extends "zeroOrOne" ? true : false
  outputOnly: false
  requiredOnCreate: TCardinality extends "one" ? true : false
}

type LinkPropertyFor<TObjectType extends string, TLink extends LinkType> =
  TLink extends LinkType<string, infer TFrom, infer TTo>
    ? TFrom["cardinality"] extends "many"
      ? TTo["cardinality"] extends "many"
        ? object
        : TTo["typeId"] extends TObjectType
          ? {
              readonly [TKey in `${TTo["key"]}Id`]: LinkReferenceProperty<
                TFrom["typeId"],
                Exclude<TTo["cardinality"], "many">
              >
            }
          : object
      : TFrom["typeId"] extends TObjectType
        ? {
            readonly [TKey in `${TFrom["key"]}Id`]: LinkReferenceProperty<
              TTo["typeId"],
              Exclude<TFrom["cardinality"], "many">
            >
          }
        : object
    : object

type UnionToIntersection<TValue> = (
  TValue extends unknown ? (value: TValue) => void : never
) extends (value: infer TIntersection) => void
  ? TIntersection
  : never

type LinkPropertiesFor<
  TObjectType extends string,
  TLinks extends ReadonlyArray<LinkType>,
> = [TLinks[number]] extends [never]
  ? object
  : Simplify<UnionToIntersection<LinkPropertyFor<TObjectType, TLinks[number]>>>

type BoundProperties<
  TObjectType extends string,
  TObjectProperties extends Properties,
  TLinks extends ReadonlyArray<LinkType>,
> =
  Simplify<
    TObjectProperties & LinkPropertiesFor<TObjectType, TLinks>
  > extends infer TResult extends Properties
    ? TResult
    : never

type BoundObject<
  TObject extends ObjectType,
  TLinks extends ReadonlyArray<LinkType>,
> =
  TObject extends ObjectType<
    infer TId,
    infer TCollection,
    infer TProperties,
    infer TActions,
    infer TParentObjectType,
    infer TInterfaces
  >
    ? ObjectType<
        TId,
        TCollection,
        BoundProperties<TId, TProperties, TLinks>,
        TActions,
        TParentObjectType,
        TInterfaces
      >
    : never

type ObjectRegistry<
  TObjects extends ReadonlyArray<ObjectType>,
  TLinks extends ReadonlyArray<LinkType>,
> = {
  readonly [TObject in TObjects[number] as TObject["id"]]: BoundObject<
    TObject,
    TLinks
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
  TObjects extends ReadonlyArray<ObjectType> = ReadonlyArray<ObjectType>,
  TLinks extends ReadonlyArray<LinkType> = ReadonlyArray<LinkType>,
  TInterfaces extends ReadonlyArray<InterfaceType> =
    ReadonlyArray<InterfaceType>,
> {
  readonly [modelTypes]?: {
    readonly links: TLinks
    readonly interfaces: TInterfaces
    readonly objects: ReadonlyArray<BoundObject<TObjects[number], TLinks>>
  }
  actions: ActionRegistry<TObjects>
  id: TId
  interfaces: InterfaceRegistry<TInterfaces>
  kind: "model"
  links: LinkRegistry<TLinks>
  name: string
  objects: ObjectRegistry<TObjects, TLinks>
  root: RootType
}

export type ModelObject<TModel extends ModelCatalog> = NonNullable<
  TModel[typeof modelTypes]
>["objects"][number]

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

function storedLinkSide(
  link: LinkType
): { readonly side: LinkSide; readonly targetTypeId: string } | undefined {
  return link.from.cardinality === "many"
    ? undefined
    : { side: link.from, targetTypeId: link.to.typeId }
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
      const stored = storedLinkSide(link)
      if (stored === undefined || stored.side.typeId !== object.id) return []

      const propertyId = `${stored.side.key}Id`
      if (Object.hasOwn(object.properties, propertyId)) {
        throw new Error(
          `Object '${object.id}' property '${propertyId}' duplicates link '${link.id}'; the model derives singular link ID properties automatically.`
        )
      }
      const options: LinkReferenceOptions = { label: stored.side.label }
      if (stored.side.description !== undefined) {
        options.description = stored.side.description
      }
      if (stored.side.cardinality === "zeroOrOne") options.nullable = true
      return [
        [
          propertyId,
          schema.recordId({ id: stored.targetTypeId }, options),
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

export function defineModel<
  const TId extends string,
  const TObjects extends ReadonlyArray<ObjectType>,
  const TLinks extends ReadonlyArray<LinkType>,
  const TInterfaces extends ReadonlyArray<InterfaceType> = [],
>(definition: {
  id: TId
  interfaces?: TInterfaces
  links: TLinks
  name: string
  objects: TObjects
}): Model<TId, TObjects, TLinks, TInterfaces> {
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

  const interfaceDefinitions = definition.interfaces ?? []
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

  const registeredObjectTypeIds = new Set(objectTypeIds)
  const registeredTypeIds = new Set([
    Root.id,
    ...objectTypeIds,
    ...interfaceIds,
  ])
  for (const object of definition.objects) {
    if (
      object.parent.objectType !== Root.id &&
      !registeredObjectTypeIds.has(object.parent.objectType)
    ) {
      throw new Error(
        `Object '${object.id}' parent references object '${object.parent.objectType}', which is not registered in model '${definition.id}'.`
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

  const objectsById = new Map(
    definition.objects.map((object) => [object.id, object])
  )
  for (const object of definition.objects) {
    const ancestry = new Set([object.id])
    let parentObjectType = object.parent.objectType
    while (parentObjectType !== Root.id) {
      if (ancestry.has(parentObjectType)) {
        throw new Error(
          `Object '${object.id}' has a cyclic parent hierarchy in model '${definition.id}'.`
        )
      }
      ancestry.add(parentObjectType)
      const parent = objectsById.get(parentObjectType)
      if (parent === undefined) break
      parentObjectType = parent.parent.objectType
    }
  }

  for (const link of definition.links) {
    if (link.from.cardinality === "many" && link.to.cardinality !== "many") {
      throw new Error(
        `Link '${link.id}' must put its singular reference-bearing side in 'from'; swap the link sides.`
      )
    }
    const stored = storedLinkSide(link)
    if (
      stored !== undefined &&
      !registeredObjectTypeIds.has(stored.side.typeId)
    ) {
      throw new Error(
        `Link '${link.id}' stores its singular '${stored.side.key}' side on interface '${stored.side.typeId}'; singular link ownership must be on an object.`
      )
    }
    for (const side of [link.from, link.to]) {
      if (!registeredTypeIds.has(side.typeId)) {
        throw new Error(
          `Link '${link.id}' references type '${side.typeId}', which is not registered in model '${definition.id}'.`
        )
      }
      const object = objectsById.get(side.typeId)
      if (object !== undefined && Object.hasOwn(object.properties, side.key)) {
        throw new Error(
          `Link '${link.id}' traversal '${side.typeId}.${side.key}' conflicts with an object property.`
        )
      }
      const interfaceType = interfaceDefinitions.find(
        (item) => item.id === side.typeId
      )
      if (
        interfaceType !== undefined &&
        Object.hasOwn(interfaceType.properties, side.key)
      ) {
        throw new Error(
          `Link '${link.id}' traversal '${side.typeId}.${side.key}' conflicts with an interface property.`
        )
      }
    }
  }

  const linkMethods = definition.links.flatMap((link) => [
    `${link.from.typeId}.${link.from.key}`,
    `${link.to.typeId}.${link.to.key}`,
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
    id: definitionId(definition.id),
    interfaces,
    kind: "model",
    links,
    name: definition.name,
    objects,
    root: Root,
  } as unknown as Model<TId, TObjects, TLinks, TInterfaces>
}

export function modelActions(model: ModelCatalog): ReadonlyArray<Action> {
  return Object.values(model.actions).flatMap((group) => Object.values(group))
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
