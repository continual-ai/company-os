import { Brand } from "effect"

import type { ActorId } from "#/runtime/model/core/actor.ts"
import { Root, type RootType } from "#/runtime/model/core/root.ts"
import {
  type ActionDefinitions,
  type Action,
  type NormalizedActions,
  bindActions,
  standardActions,
} from "#/runtime/model/definition/action.ts"
import { definitionId } from "#/runtime/model/definition/identity.ts"
import {
  type InterfaceImplementation,
  type InterfaceImplementationConstraints,
  type InterfaceImplementationInputs,
  type InterfaceImplementationMap,
  bindInterfaceImplementations,
} from "#/runtime/model/definition/interface.ts"
import type { InterfaceType } from "#/runtime/model/definition/interface.ts"
import {
  type InferProperties,
  type InferProperty,
  type NormalizeProperties,
  type Properties,
  normalizeProperties,
} from "#/runtime/model/definition/property.ts"
import {
  bindQueries,
  type BoundQueries,
  type CustomQuery,
  type QueryDefinitions,
} from "#/runtime/model/definition/query.ts"
import type {
  AnySchema,
  EnumSchema,
  ImageSchema,
  InferInputSchema,
  RecordAlias,
  RecordId,
  RecordIdentifier,
  Timestamp,
} from "#/runtime/model/definition/schema.ts"
import { assertReferencePropertyName } from "#/runtime/model/definition/schema.ts"

export interface ObjectParent<
  TTypeId extends string = string,
  TKind extends "interface" | "object" | "root" =
    | "interface"
    | "object"
    | "root",
> {
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
  TParentId extends RecordId = RecordId,
> {
  readonly aliases: ReadonlyArray<RecordAlias>
  readonly metadata: Readonly<Record<string, string>>
  readonly createdAt: Timestamp
  readonly createdBy: ActorId
  readonly etag: Etag
  readonly id: RecordId<TObjectType>
  /** The owning record; the root record when the object is defined directly beneath Root. */
  readonly parent: TParentId
  /** Whether ordinary mutations are reserved for trusted system workflows. */
  readonly systemManaged: boolean
  readonly updatedAt: Timestamp
  readonly updatedBy: ActorId
}

/** Interface parents accept any implementer, so only concrete parents narrow the ID. */
export type ObjectParentRecordId<TObject extends ObjectType> =
  TObject["parent"]["kind"] extends "interface"
    ? RecordId
    : RecordId<TObject["parent"]["typeId"]>

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
  TParent extends ObjectParent = ObjectParent,
  TInterfaces extends Readonly<Record<string, InterfaceImplementation>> =
    Readonly<Record<string, InterfaceImplementation>>,
  TQueries extends Readonly<Record<string, CustomQuery>> = Readonly<
    Record<string, CustomQuery>
  >,
> {
  actions: TActions
  queries: TQueries
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
  parent: TParent
  pluralName: string
  properties: TProperties
  search?: { readonly fields: ReadonlyArray<string> } | undefined
  uniqueBy: Readonly<Record<string, ReadonlyArray<string>>>
}

export type ObjectRecord<TObject extends ObjectType> = BaseRecord<
  TObject["id"],
  ObjectParentRecordId<TObject>
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

/**
 * Objects beneath Root never take a parent. An interface parent accepts any
 * identifier here; the model-bound create input narrows it to implementers.
 */
type CreateParent<TObject extends ObjectType> =
  TObject["parent"]["kind"] extends "root"
    ? { readonly parent?: never }
    : TObject["parent"]["kind"] extends "object"
      ? { readonly parent: RecordIdentifier<TObject["parent"]["typeId"]> }
      : { readonly parent: RecordIdentifier }

type CanonicalCreateParent<TObject extends ObjectType> =
  TObject["parent"]["kind"] extends "root"
    ? { readonly parent?: never }
    : Pick<ObjectRecord<TObject>, "parent">

/** Public create values other than the parent, which the model binds separately. */
export type ObjectCreateProperties<TObject extends ObjectType> = Simplify<
  BaseCreateProperties & {
    readonly [
      TKey in RequiredCreatePropertyKeys<TObject["properties"]>
    ]: PropertyInputValue<TObject["properties"][TKey]>
  } & {
    readonly [
      TKey in OptionalCreatePropertyKeys<TObject["properties"]>
    ]?: PropertyInputValue<TObject["properties"][TKey]>
  }
>

export type ObjectCreateInput<TObject extends ObjectType> = Simplify<
  ObjectCreateProperties<TObject> & CreateParent<TObject>
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
 * `parent` is the ownership and authorization hierarchy and defaults to Root;
 * ordinary business relationships belong in links.
 */
export function defineObject<
  const TId extends string,
  const TCollection extends string,
  const TProperties extends Readonly<Record<string, AnySchema>>,
  const TActionDefinitions extends ActionDefinitions = {},
  const TParent extends ParentDefinition = RootType,
  const TImplementations extends InterfaceImplementationInputs = [],
  const TQueries extends QueryDefinitions = {},
>(definition: {
  actions?: TActionDefinitions
  queries?: TQueries
  collection: TCollection
  description?: string
  display: ObjectDisplay<NormalizeProperties<TProperties>>
  id: TId
  implements?: TImplementations &
    InterfaceImplementationConstraints<TProperties, TImplementations>
  name: string
  parent?: TParent
  pluralName: string
  properties: TProperties
  /** Opts into cross-object search. Only these text fields are indexed; display title matches rank higher. */
  search?: { readonly fields: ReadonlyArray<keyof TProperties & string> }
  uniqueBy?: Readonly<Record<string, ReadonlyArray<string>>>
}): ObjectType<
  TId,
  TCollection,
  NormalizeProperties<TProperties>,
  NormalizedActions<TId, TActionDefinitions>,
  ObjectParent<TParent["id"], TParent["kind"]>,
  InterfaceImplementationMap<TImplementations>,
  BoundQueries<TId, TQueries>
> {
  const parent: ParentDefinition = definition.parent ?? Root
  if (Object.hasOwn(definition.properties, parent.id)) {
    throw new Error(
      `Object '${definition.id}' cannot redefine its '${parent.id}' parent as property '${parent.id}'; use the standard 'parent'.`
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
  if (definition.search !== undefined) {
    if (definition.search.fields.length === 0)
      throw new Error(
        `Object '${definition.id}' search requires at least one field.`
      )
    for (const field of definition.search.fields) {
      const property = properties[field]
      if (
        property?.kind !== "string" ||
        property.format === "date" ||
        property.format === "timestamp"
      )
        throw new Error(
          `Object '${definition.id}' search field '${field}' must be text.`
        )
    }
  }
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
  const queries = bindQueries(identity, definition.queries)
  for (const id of Object.keys(queries)) {
    if (Object.hasOwn(bound.actions, id))
      throw new Error(`Object '${identity.id}' duplicates operation '${id}'.`)
  }
  const metadata = {
    kind: "object" as const,
    id: identity.id,
    collection: identity.collection,
    name: definition.name,
    interfaces,
    parent: { kind: parent.kind, typeId: parent.id },
    pluralName: definition.pluralName,
    display: definition.display,
    properties,
    uniqueBy,
    ...(definition.search === undefined ? {} : { search: definition.search }),
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
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const object = {
    ...metadata,
    actions,
    queries,
  } as unknown as ObjectType<
    TId,
    TCollection,
    NormalizeProperties<TProperties>,
    NormalizedActions<TId, TActionDefinitions>,
    ObjectParent<TParent["id"], TParent["kind"]>,
    InterfaceImplementationMap<TImplementations>,
    BoundQueries<TId, TQueries>
  >
  if (definition.description !== undefined) {
    return { ...object, description: definition.description }
  }
  return object
}
