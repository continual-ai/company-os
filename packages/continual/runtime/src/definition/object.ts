import { Brand } from "effect"

import {
  type ActionDefinitions,
  type Action,
  type ActionSettings,
  type BoundActions,
  type NormalizedActionSettings,
  bindActions,
} from "./action"
import { definitionId } from "./identity"
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
  RecordId,
  Timestamp,
} from "./schema"

export interface ObjectParent<TObjectId extends string = string> {
  readonly kind: "object" | "root"
  readonly objectId: TObjectId
}

export interface BaseRecord<
  TObjectId extends string = string,
  TParentObjectId extends string = string,
> {
  readonly annotations: Readonly<Record<string, string>>
  readonly createdAt: Timestamp
  readonly createdById: ActorId
  readonly etag: Etag
  readonly id: RecordId<TObjectId>
  readonly parentId: RecordId<TParentObjectId>
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

export interface ObjectDisplay<TProperties extends Properties> {
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
  TActionSettings extends ActionSettings = ActionSettings,
  TParentObjectId extends string = string,
> {
  actions: TActions
  collection: TCollection
  defaultActions: TActionSettings
  description?: string
  display: {
    image?: string
    status?: string
    subtitle?: string
    title: string
  }
  id: TId
  kind: "object"
  name: string
  parent: ObjectParent<TParentObjectId>
  pluralName: string
  properties: TProperties
}

export type ObjectRecord<TObject extends ObjectType> = BaseRecord<
  TObject["id"],
  TObject["parent"]["objectId"]
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
  ]: TProperties[TKey]["required"] extends true ? TKey : never
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

interface BaseWriteProperties {
  readonly annotations?: Readonly<Record<string, string>>
}

type CreateParent<TObject extends ObjectType> =
  TObject["parent"]["objectId"] extends RootType["id"]
    ? { readonly parentId?: never }
    : Pick<ObjectRecord<TObject>, "parentId">

export type ObjectCreateInput<TObject extends ObjectType> = Simplify<
  BaseWriteProperties &
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
  BaseWriteProperties & {
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

export type ObjectUpdateRequest<TObject extends ObjectType> = Simplify<
  ObjectGetInput<TObject> & ObjectUpdateInput<TObject>
>

const reservedPropertyIds = new Set([
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
>(definition: {
  actions?: TActionDefinitions
  collection: TCollection
  description?: string
  display: ObjectDisplay<NormalizeProperties<TProperties>>
  id: TId
  name: string
  parent: TParent
  pluralName: string
  properties: TProperties
}): ObjectType<
  TId,
  TCollection,
  NormalizeProperties<TProperties>,
  BoundActions<TId, TActionDefinitions>,
  NormalizedActionSettings<TActionDefinitions>,
  TParent["id"]
> {
  if (definition.id === Root.id) {
    throw new Error(`Object id '${Root.id}' is reserved for the built-in Root.`)
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
  for (const [role, propertyId] of Object.entries(definition.display)) {
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
  const object = {
    kind: "object" as const,
    id: identity.id,
    collection: identity.collection,
    name: definition.name,
    parent: {
      kind: definition.parent.kind,
      objectId: definition.parent.id,
    },
    pluralName: definition.pluralName,
    display: definition.display,
    properties,
    actions: bound.actions,
    defaultActions: bound.defaults,
  }
  if (definition.description !== undefined) {
    return { ...object, description: definition.description }
  }
  return object
}
