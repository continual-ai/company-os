import { Brand } from "effect"

import {
  type ActionDefinitions,
  type Action,
  type NormalizedActions,
  bindActions,
  standardActions,
} from "./action"
import { definitionId } from "./identity"
import {
  type BoundInterfaceImplementations,
  type InterfaceImplementation,
  type InterfaceImplementationDefinitions,
  bindInterfaceImplementations,
} from "./interface"
import {
  type InferProperties,
  type InferProperty,
  type NormalizeProperties,
  type Properties,
  normalizeProperties,
} from "./property"
import { Root, type RootType } from "./root"
import type {
  AnySchema,
  EnumSchema,
  ImageSchema,
  ObjectAlias,
  RecordId,
  Timestamp,
} from "./schema"

export interface ObjectParent<TObjectType extends string = string> {
  readonly objectType: TObjectType
}

/** A typed reference used when records from multiple object types can appear. */
export type ObjectRef<TObjectType extends string = string> =
  TObjectType extends string
    ? {
        readonly id: RecordId<TObjectType>
        readonly objectType: TObjectType
      }
    : never

export interface BaseRecord<
  TObjectType extends string = string,
  TParentObjectType extends string = string,
> {
  readonly aliases: ReadonlyArray<ObjectAlias>
  readonly annotations: Readonly<Record<string, string>>
  readonly createdAt: Timestamp
  readonly createdById: ActorId
  readonly etag: Etag
  readonly id: RecordId<TObjectType>
  readonly parentId: RecordId<TParentObjectType>
  readonly updatedAt: Timestamp
  readonly updatedById: ActorId
}

export type ActorId = string & Brand.Brand<"ActorId">
export const ActorId = Brand.make<ActorId>(
  (value) => value.length > 0 || "Expected a non-empty actor ID"
)

export type Etag = string & Brand.Brand<"Etag">
export const Etag = Brand.make<Etag>(
  (value) => value.length > 0 || "Expected a non-empty etag"
)

export interface ObjectAliasDelta {
  readonly add?: ReadonlyArray<ObjectAlias>
  readonly remove?: ReadonlyArray<ObjectAlias>
}

/** An array replaces the complete set; an object applies an atomic delta. */
export type ObjectAliasUpdate = ObjectAliasDelta | ReadonlyArray<ObjectAlias>

export interface ObjectDisplay<TProperties extends Properties> {
  icon?: string
  image?: {
    [TKey in keyof TProperties]: TProperties[TKey] extends ImageSchema
      ? TKey
      : never
  }[keyof TProperties] &
    string
  status?: {
    [TKey in keyof TProperties]: TProperties[TKey] extends EnumSchema
      ? TKey
      : never
  }[keyof TProperties] &
    string
  subtitle?: keyof TProperties & string
  title: keyof TProperties & string
}

export interface ObjectType<
  TId extends string = string,
  TCollection extends string = string,
  TProperties extends Properties = Properties,
  TActions extends Readonly<Record<string, Action>> = Readonly<
    Record<string, Action>
  >,
  TParentObjectType extends string = string,
  TInterfaces extends Readonly<Record<string, InterfaceImplementation>> =
    Readonly<Record<string, InterfaceImplementation>>,
> {
  actions: TActions
  collection: TCollection
  description?: string
  display: {
    icon?: string
    image?: string
    status?: string
    subtitle?: string
    title: string
  }
  id: TId
  interfaces: TInterfaces
  kind: "object"
  name: string
  parent: ObjectParent<TParentObjectType>
  pluralName: string
  properties: TProperties
}

export type ObjectRecord<TObject extends ObjectType> = BaseRecord<
  TObject["id"],
  TObject["parent"]["objectType"]
> &
  InferProperties<TObject["properties"]>

type PropertyValue<TProperty extends Properties[string]> =
  InferProperty<TProperty>

type CreatePropertyKeys<TProperties extends Properties> = {
  [TKey in keyof TProperties]: TProperties[TKey]["outputOnly"] extends true
    ? never
    : TKey
}[keyof TProperties]

type RequiredCreatePropertyKeys<TProperties extends Properties> = {
  [
    TKey in CreatePropertyKeys<TProperties>
  ]: TProperties[TKey]["requiredOnCreate"] extends true ? TKey : never
}[CreatePropertyKeys<TProperties>]

type OptionalCreatePropertyKeys<TProperties extends Properties> = Exclude<
  CreatePropertyKeys<TProperties>,
  RequiredCreatePropertyKeys<TProperties>
>

type UpdatePropertyKeys<TProperties extends Properties> = {
  [TKey in keyof TProperties]: TProperties[TKey]["outputOnly"] extends true
    ? never
    : TKey
}[keyof TProperties]

type Simplify<TValue> = { [TKey in keyof TValue]: TValue[TKey] } & {}

interface BaseCreateProperties {
  readonly aliases?: ReadonlyArray<ObjectAlias>
  readonly annotations?: Readonly<Record<string, string>>
}

interface BaseUpdateProperties {
  readonly aliases?: ObjectAliasUpdate
  readonly annotations?: Readonly<Record<string, string>>
}

type CreateParent<TObject extends ObjectType> =
  TObject["parent"]["objectType"] extends RootType["id"]
    ? { readonly parentId?: never }
    : Pick<ObjectRecord<TObject>, "parentId">

export type ObjectCreateInput<TObject extends ObjectType> = Simplify<
  BaseCreateProperties &
    CreateParent<TObject> & {
      readonly [
        TKey in RequiredCreatePropertyKeys<TObject["properties"]>
      ]: PropertyValue<TObject["properties"][TKey]>
    } & {
      readonly [
        TKey in OptionalCreatePropertyKeys<TObject["properties"]>
      ]?: PropertyValue<TObject["properties"][TKey]>
    }
>

export type ObjectUpdateInput<TObject extends ObjectType> = Simplify<
  BaseUpdateProperties & {
    readonly [
      TKey in UpdatePropertyKeys<TObject["properties"]>
    ]?: PropertyValue<TObject["properties"][TKey]>
  }
>

export type ObjectGetInput<TObject extends ObjectType> = {
  readonly id: RecordId<TObject["id"]>
}

export type ObjectDeleteInput<TObject extends ObjectType> =
  ObjectGetInput<TObject>

export interface ObjectBatchDeleteInput<TObject extends ObjectType> {
  readonly ids: ReadonlyArray<RecordId<TObject["id"]>>
}

export type ObjectUpdateRequest<TObject extends ObjectType> = Simplify<
  ObjectGetInput<TObject> & ObjectUpdateInput<TObject>
>

const reservedPropertyIds = new Set([
  "aliases",
  "annotations",
  "createdAt",
  "createdById",
  "etag",
  "id",
  "parentId",
  "updatedAt",
  "updatedById",
])

type ParentDefinition = RootType | ObjectType

export function defineObject<
  const TId extends string,
  const TCollection extends string,
  const TProperties extends Readonly<Record<string, AnySchema>>,
  const TActionDefinitions extends ActionDefinitions = {},
  const TParent extends ParentDefinition = ParentDefinition,
  const TImplementations extends
    InterfaceImplementationDefinitions<TProperties> = [],
>(definition: {
  actions?: TActionDefinitions
  collection: TCollection
  description?: string
  display: ObjectDisplay<NormalizeProperties<TProperties>>
  id: TId
  implements?: TImplementations
  name: string
  parent: TParent
  pluralName: string
  properties: TProperties
}): ObjectType<
  TId,
  TCollection,
  NormalizeProperties<TProperties>,
  NormalizedActions<TId, TActionDefinitions>,
  TParent["id"],
  BoundInterfaceImplementations<TImplementations>
> {
  if (definition.id === Root.id) {
    throw new Error(`Object id '${Root.id}' is reserved for the built-in Root.`)
  }
  const semanticParentPropertyId = `${definition.parent.id}Id`
  if (Object.hasOwn(definition.properties, semanticParentPropertyId)) {
    throw new Error(
      `Object '${definition.id}' cannot redefine its '${definition.parent.id}' parent as property '${semanticParentPropertyId}'; use the standard 'parentId'.`
    )
  }
  for (const propertyId of Object.keys(definition.properties)) {
    definitionId(propertyId)
    if (reservedPropertyIds.has(propertyId)) {
      throw new Error(
        `Object '${definition.id}' cannot redefine base property '${propertyId}'.`
      )
    }
  }

  const properties = normalizeProperties(definition.properties)
  const interfaces = bindInterfaceImplementations(
    definition.id,
    properties,
    definition.implements ?? []
  )
  for (const [role, propertyId] of Object.entries(definition.display)) {
    if (role === "icon") {
      definitionId(propertyId)
      continue
    }
    const property = properties[propertyId]
    if (property === undefined) {
      throw new Error(
        `Object '${definition.id}' display ${role} references unknown property '${propertyId}'.`
      )
    }
    if (role === "image" && property.kind !== "image") {
      throw new Error(
        `Object '${definition.id}' display image must reference an image property.`
      )
    }
    if (role === "status" && property.kind !== "enum") {
      throw new Error(
        `Object '${definition.id}' display status must reference an enum property.`
      )
    }
  }

  const identity = {
    id: definitionId(definition.id),
    collection: definitionId(definition.collection),
  }
  const bound = bindActions(identity, definition.actions)
  const metadata = {
    kind: "object" as const,
    id: identity.id,
    collection: identity.collection,
    name: definition.name,
    interfaces,
    parent: { objectType: definition.parent.id },
    pluralName: definition.pluralName,
    display: definition.display,
    properties,
  }
  const actions = {
    ...Object.fromEntries(
      standardActions(metadata, bound.standard).map((action) => [
        action.id,
        action,
      ])
    ),
    ...bound.actions,
  }
  // SAFETY: bindActions rejects authored standard IDs and standardActions
  // materializes exactly the actions enabled by the inferred settings.
  // oxlint-disable-next-line anti-slop/no-chained-type-assertions, typescript/no-unsafe-type-assertion
  const object = {
    ...metadata,
    actions,
  } as unknown as ObjectType<
    TId,
    TCollection,
    NormalizeProperties<TProperties>,
    NormalizedActions<TId, TActionDefinitions>,
    TParent["id"],
    BoundInterfaceImplementations<TImplementations>
  >
  if (definition.description !== undefined) {
    return { ...object, description: definition.description }
  }
  return object
}
