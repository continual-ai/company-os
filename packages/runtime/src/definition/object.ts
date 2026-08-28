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
  type InterfaceImplementation,
  type InterfaceImplementationConstraints,
  type InterfaceImplementationInputs,
  type InterfaceImplementationMap,
  bindInterfaceImplementations,
} from "./interface"
import type { InterfaceType } from "./interface"
import {
  type InferProperties,
  type InferProperty,
  type NormalizeProperties,
  type Properties,
  normalizeProperties,
} from "./property"
import type { RootType } from "./root"
import type {
  AnySchema,
  EnumSchema,
  ImageSchema,
  InferInputSchema,
  RecordAlias,
  RecordId,
  RecordIdentifier,
  Timestamp,
} from "./schema"
import { assertReferencePropertyName } from "./schema"

declare const parentRecordType: unique symbol
declare const actorRecordType: unique symbol

type RecordIds<TTypeId extends string> = TTypeId extends string
  ? RecordId<TTypeId>
  : never

export interface ObjectParent<
  TTypeId extends string = string,
  TKind extends "interface" | "object" | "root" =
    | "interface"
    | "object"
    | "root",
  TRecordTypeId extends string = TTypeId,
> {
  readonly [parentRecordType]?: TRecordTypeId
  readonly kind: TKind
  readonly typeId: TTypeId
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
  TParentTypeId extends string = string,
  TActorTypeId extends string = string,
> {
  readonly aliases: ReadonlyArray<RecordAlias>
  readonly metadata: Readonly<Record<string, string>>
  readonly createdAt: Timestamp
  readonly createdBy: RecordIds<TActorTypeId>
  readonly etag: Etag
  readonly id: RecordId<TObjectType>
  readonly parent: TParentTypeId extends string
    ? RecordId<TParentTypeId>
    : never
  /** Whether ordinary mutations are reserved for trusted system workflows. */
  readonly systemManaged: boolean
  readonly updatedAt: Timestamp
  readonly updatedBy: RecordIds<TActorTypeId>
}

export type Etag = string & Brand.Brand<"Etag">
export const Etag = Brand.make<Etag>(
  (value) => value.length > 0 || "Expected a non-empty etag"
)

export interface RecordAliasDelta {
  readonly add?: ReadonlyArray<RecordAlias>
  readonly remove?: ReadonlyArray<RecordAlias>
}

/** An array replaces the complete set; an object applies an atomic delta. */
export type RecordAliasUpdate = RecordAliasDelta | ReadonlyArray<RecordAlias>

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
  subtitle?: (keyof TProperties & string) | "id"
  title: (keyof TProperties & string) | "id"
}

export interface ObjectType<
  TId extends string = string,
  TCollection extends string = string,
  TProperties extends Properties = Properties,
  TActions extends Readonly<Record<string, Action>> = Readonly<
    Record<string, Action>
  >,
  TParentTypeId extends string = string,
  TParentKind extends ObjectParent["kind"] = ObjectParent["kind"],
  TParentRecordTypeId extends string = TParentTypeId,
  TInterfaces extends Readonly<Record<string, InterfaceImplementation>> =
    Readonly<Record<string, InterfaceImplementation>>,
  TActorRecordTypeId extends string = string,
> {
  readonly [actorRecordType]?: TActorRecordTypeId
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
  parent: ObjectParent<TParentTypeId, TParentKind, TParentRecordTypeId>
  pluralName: string
  properties: TProperties
  uniqueBy: Readonly<Record<string, ReadonlyArray<string>>>
}

export type ObjectParentRecordTypeId<TObject extends ObjectType> = NonNullable<
  TObject["parent"][typeof parentRecordType]
>

export type ObjectActorRecordTypeId<TObject extends ObjectType> = NonNullable<
  TObject[typeof actorRecordType]
>

export type ObjectRecord<TObject extends ObjectType> = BaseRecord<
  TObject["id"],
  ObjectParentRecordTypeId<TObject>,
  ObjectActorRecordTypeId<TObject>
> &
  InferProperties<TObject["properties"]>

type PropertyValue<TProperty extends Properties[string]> =
  InferProperty<TProperty>

type PropertyInputValue<TProperty extends Properties[string]> =
  InferInputSchema<TProperty>

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

type ObjectWriterUpdateChanges<TObject extends ObjectType> = Simplify<
  BaseUpdateProperties & {
    readonly [TKey in keyof TObject["properties"]]?: PropertyInputValue<
      TObject["properties"][TKey]
    >
  }
>

type Simplify<TValue> = { [TKey in keyof TValue]: TValue[TKey] } & {}

interface BaseCreateProperties {
  readonly aliases?: ReadonlyArray<RecordAlias>
  readonly metadata?: Readonly<Record<string, string>>
}

interface BaseUpdateProperties {
  readonly aliases?: RecordAliasUpdate
  readonly metadata?: Readonly<Record<string, string>>
}

type CreateParent<TObject extends ObjectType> =
  TObject["parent"]["kind"] extends "root"
    ? { readonly parent?: never }
    : {
        readonly parent: RecordIdentifier<ObjectParentRecordTypeId<TObject>>
      }

type CanonicalCreateParent<TObject extends ObjectType> =
  TObject["parent"]["kind"] extends "root"
    ? { readonly parent?: never }
    : Pick<ObjectRecord<TObject>, "parent">

export type ObjectCreateInput<TObject extends ObjectType> = Simplify<
  BaseCreateProperties &
    CreateParent<TObject> & {
      readonly [
        TKey in RequiredCreatePropertyKeys<TObject["properties"]>
      ]: PropertyInputValue<TObject["properties"][TKey]>
    } & {
      readonly [
        TKey in OptionalCreatePropertyKeys<TObject["properties"]>
      ]?: PropertyInputValue<TObject["properties"][TKey]>
    }
>

type ObjectUpdateChanges<TObject extends ObjectType> = Simplify<
  BaseUpdateProperties & {
    readonly [
      TKey in UpdatePropertyKeys<TObject["properties"]>
    ]?: PropertyInputValue<TObject["properties"][TKey]>
  }
>

/** Canonical create values passed from the object service to persistence. */
export type ObjectCreateValues<TObject extends ObjectType> = Simplify<
  BaseCreateProperties &
    CanonicalCreateParent<TObject> & {
      readonly [
        TKey in RequiredCreatePropertyKeys<TObject["properties"]>
      ]: PropertyValue<TObject["properties"][TKey]>
    } & {
      readonly [
        TKey in OptionalCreatePropertyKeys<TObject["properties"]>
      ]?: PropertyValue<TObject["properties"][TKey]>
    }
>

/** Canonical update values passed from the object service to persistence. */
export type ObjectUpdateValues<TObject extends ObjectType> = Simplify<
  BaseUpdateProperties & {
    readonly [TKey in keyof TObject["properties"]]?: PropertyValue<
      TObject["properties"][TKey]
    >
  }
>

export type ObjectGetInput<TObject extends ObjectType> = {
  readonly id: RecordIdentifier<TObject["id"]>
}

interface ObjectWritePrecondition {
  readonly etag?: Etag
}

export type ObjectDeleteInput<TObject extends ObjectType> =
  ObjectGetInput<TObject> & ObjectWritePrecondition

export interface ObjectBatchGetInput<TObject extends ObjectType> {
  readonly ids: ReadonlyArray<RecordIdentifier<TObject["id"]>>
}

export interface ObjectBatchDeleteInput<TObject extends ObjectType> {
  readonly ids: ReadonlyArray<RecordIdentifier<TObject["id"]>>
}

export type ObjectUpdateInput<TObject extends ObjectType> =
  ObjectGetInput<TObject> &
    ObjectWritePrecondition &
    ObjectUpdateChanges<TObject>

/** Update input accepted only by trusted server-internal object writers. */
export type ObjectWriterUpdateInput<TObject extends ObjectType> =
  ObjectGetInput<TObject> &
    ObjectWritePrecondition &
    ObjectWriterUpdateChanges<TObject>

const reservedPropertyIds = new Set([
  "aliases",
  "createdAt",
  "createdBy",
  "etag",
  "id",
  "metadata",
  "parent",
  "systemManaged",
  "updatedAt",
  "updatedBy",
])

type ParentDefinition = InterfaceType | ObjectType | RootType

/**
 * Defines a portable model object and derives its enabled standard actions.
 * `parent` is the canonical ownership hierarchy; ordinary business
 * relationships belong in links.
 */
export function defineObject<
  const TId extends string,
  const TCollection extends string,
  const TProperties extends Readonly<Record<string, AnySchema>>,
  const TActionDefinitions extends ActionDefinitions = {},
  const TParent extends ParentDefinition = ParentDefinition,
  const TImplementations extends InterfaceImplementationInputs = [],
>(definition: {
  actions?: TActionDefinitions
  collection: TCollection
  description?: string
  display: ObjectDisplay<NormalizeProperties<TProperties>>
  id: TId
  implements?: TImplementations &
    InterfaceImplementationConstraints<TProperties, TImplementations>
  name: string
  parent: TParent
  pluralName: string
  properties: TProperties
  uniqueBy?: Readonly<Record<string, ReadonlyArray<string>>>
}): ObjectType<
  TId,
  TCollection,
  NormalizeProperties<TProperties>,
  NormalizedActions<TId, TActionDefinitions>,
  TParent["id"],
  TParent["kind"],
  TParent["id"],
  InterfaceImplementationMap<TImplementations>
> {
  const semanticParentPropertyId = definition.parent.id
  if (Object.hasOwn(definition.properties, semanticParentPropertyId)) {
    throw new Error(
      `Object '${definition.id}' cannot redefine its '${definition.parent.id}' parent as property '${semanticParentPropertyId}'; use the standard 'parent'.`
    )
  }
  for (const [propertyId, property] of Object.entries(definition.properties)) {
    definitionId(propertyId)
    assertReferencePropertyName(
      `Object '${definition.id}'`,
      propertyId,
      property
    )
    if (reservedPropertyIds.has(propertyId)) {
      throw new Error(
        `Object '${definition.id}' cannot redefine base property '${propertyId}'.`
      )
    }
  }
  const uniqueBy = definition.uniqueBy ?? {}
  for (const [ruleId, fields] of Object.entries(uniqueBy)) {
    definitionId(ruleId)
    if (fields.length === 0) {
      throw new Error(
        `Object '${definition.id}' unique rule '${ruleId}' must reference at least one field.`
      )
    }
    const duplicateField = fields.find(
      (field, index) => fields.indexOf(field) !== index
    )
    if (duplicateField !== undefined) {
      throw new Error(
        `Object '${definition.id}' unique rule '${ruleId}' references field '${duplicateField}' more than once.`
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
    if (propertyId === "id" && (role === "title" || role === "subtitle")) {
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
    parent: {
      kind: definition.parent.kind,
      typeId: definition.parent.id,
    },
    pluralName: definition.pluralName,
    display: definition.display,
    properties,
    uniqueBy,
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
    TParent["kind"],
    TParent["id"],
    InterfaceImplementationMap<TImplementations>
  >
  if (definition.description !== undefined) {
    return { ...object, description: definition.description }
  }
  return object
}
