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
import {
  definitionId,
  type NoExtraKeys,
  type OpenOr,
} from "#/runtime/model/definition/identity.ts"
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

type ParentDefinition = InterfaceType | ObjectType | RootType

interface ObjectDisplayDefinition {
  icon?: string
  image?: string
  status?: string
  subtitle?: string
  title: string
}

/**
 * What `defineObject` accepts. Constraints that relate one member to another,
 * such as display roles naming real properties, live in the parameter's
 * intersection so the whole definition still infers as one literal type.
 */
export interface ObjectDefinition {
  readonly actions?: ActionDefinitions
  readonly queries?: QueryDefinitions
  readonly collection: string
  readonly description?: string
  readonly display: ObjectDisplayDefinition
  readonly id: string
  readonly implements?: InterfaceImplementationInputs
  readonly name: string
  readonly parent?: ParentDefinition
  readonly pluralName: string
  readonly properties: Readonly<Record<string, AnySchema>>
  /** Opts into cross-object search. Only these text fields are indexed; display title matches rank higher. */
  readonly search?: { readonly fields: ReadonlyArray<string> }
  readonly uniqueBy?: Readonly<Record<string, ReadonlyArray<string>>>
}

type ObjectActionDefinitions<D extends ObjectDefinition> = D extends {
  readonly actions: infer TActions extends ActionDefinitions
}
  ? TActions
  : {}

type ObjectQueryDefinitions<D extends ObjectDefinition> = D extends {
  readonly queries: infer TQueries extends QueryDefinitions
}
  ? TQueries
  : {}

type ObjectImplementations<D extends ObjectDefinition> = D extends {
  readonly implements: infer TImplementations extends
    InterfaceImplementationInputs
}
  ? TImplementations
  : readonly []

/** The declared parent, or Root when the definition omits one. */
type ObjectParentDefinition<D extends ObjectDefinition> = D extends {
  readonly parent: infer TParent extends ParentDefinition
}
  ? TParent
  : RootType

type ObjectDefinitionConstraints<D extends ObjectDefinition> = NoExtraKeys<
  D,
  ObjectDefinition
> & {
  readonly display: ObjectDisplay<NormalizeProperties<D["properties"]>>
  readonly implements?: InterfaceImplementationConstraints<
    D["properties"],
    ObjectImplementations<D>
  >
  readonly search?: {
    readonly fields: ReadonlyArray<keyof D["properties"] & string>
  }
}

declare const objectDefinition: unique symbol

/**
 * A defined object. Every typed member derives from the one definition `D`;
 * the bare `ObjectType` is the open form every defined object is assignable
 * to, so derived members fall back to their open shapes when `D` is not one
 * literal definition. The phantom definition slot lets a model re-derive an
 * object whose interface references are bound to that model's implementers.
 */
export interface ObjectType<D extends ObjectDefinition = ObjectDefinition> {
  readonly [objectDefinition]?: D
  actions: OpenOr<
    D,
    Readonly<Record<string, Action>>,
    NormalizedActions<D["id"], ObjectActionDefinitions<D>>
  >
  queries: OpenOr<
    D,
    Readonly<Record<string, CustomQuery>>,
    BoundQueries<D["id"], ObjectQueryDefinitions<D>>
  >
  collection: D["collection"]
  description?: string
  display: D["display"]
  id: D["id"]
  interfaces: OpenOr<
    D,
    Readonly<Record<string, InterfaceImplementation>>,
    InterfaceImplementationMap<ObjectImplementations<D>>
  >
  kind: "object"
  name: string
  parent: OpenOr<
    D,
    ObjectParent,
    ObjectParent<
      ObjectParentDefinition<D>["id"],
      ObjectParentDefinition<D>["kind"]
    >
  >
  pluralName: string
  properties: OpenOr<D, Properties, NormalizeProperties<D["properties"]>>
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

/**
 * Defines a portable model object and derives its enabled standard actions.
 * `parent` is the ownership and authorization hierarchy and defaults to Root;
 * ordinary business relationships belong in links.
 */
export function defineObject<const D extends ObjectDefinition>(
  definition: D & ObjectDefinitionConstraints<D>
): ObjectType<D> {
  const input: ObjectDefinition = definition
  const parent: ParentDefinition = input.parent ?? Root
  if (Object.hasOwn(input.properties, parent.id)) {
    throw new Error(
      `Object '${input.id}' cannot redefine its '${parent.id}' parent as property '${parent.id}'; use the standard 'parent'.`
    )
  }
  for (const [propertyId, property] of Object.entries(input.properties)) {
    definitionId(propertyId)
    assertReferencePropertyName(`Object '${input.id}'`, propertyId, property)
    if (reservedPropertyIds.has(propertyId)) {
      throw new Error(
        `Object '${input.id}' cannot redefine base property '${propertyId}'.`
      )
    }
  }
  const uniqueBy = input.uniqueBy ?? {}
  for (const [ruleId, fields] of Object.entries(uniqueBy)) {
    definitionId(ruleId)
    if (fields.length === 0) {
      throw new Error(
        `Object '${input.id}' unique rule '${ruleId}' must reference at least one field.`
      )
    }
    const duplicateField = fields.find(
      (field, index) => fields.indexOf(field) !== index
    )
    if (duplicateField !== undefined) {
      throw new Error(
        `Object '${input.id}' unique rule '${ruleId}' references field '${duplicateField}' more than once.`
      )
    }
  }

  const properties = normalizeProperties(input.properties)
  if (input.search !== undefined) {
    if (input.search.fields.length === 0)
      throw new Error(
        `Object '${input.id}' search requires at least one field.`
      )
    for (const field of input.search.fields) {
      const property = properties[field]
      if (
        property?.kind !== "string" ||
        property.format === "date" ||
        property.format === "timestamp"
      )
        throw new Error(
          `Object '${input.id}' search field '${field}' must be text.`
        )
    }
  }
  const interfaces = bindInterfaceImplementations(
    input.id,
    properties,
    input.implements ?? []
  )
  for (const [role, propertyId] of Object.entries(input.display)) {
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
        `Object '${input.id}' display ${role} references unknown property '${propertyId}'.`
      )
    }
    if (role === "image" && property.kind !== "image") {
      throw new Error(
        `Object '${input.id}' display image must reference an image property.`
      )
    }
    if (role === "status" && property.kind !== "enum") {
      throw new Error(
        `Object '${input.id}' display status must reference an enum property.`
      )
    }
  }

  const identity = {
    id: definitionId(input.id),
    collection: definitionId(input.collection),
  }
  const bound = bindActions(identity, input.actions)
  const queries = bindQueries(identity, input.queries)
  for (const id of Object.keys(queries)) {
    if (Object.hasOwn(bound.actions, id))
      throw new Error(`Object '${identity.id}' duplicates operation '${id}'.`)
  }
  const metadata = {
    kind: "object" as const,
    id: identity.id,
    collection: identity.collection,
    name: input.name,
    interfaces,
    parent: { kind: parent.kind, typeId: parent.id },
    pluralName: input.pluralName,
    display: input.display,
    properties,
    uniqueBy,
    ...(input.search === undefined ? {} : { search: input.search }),
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
  } as unknown as ObjectType<D>
  if (input.description !== undefined) {
    return { ...object, description: input.description }
  }
  return object
}
