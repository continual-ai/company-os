import type { AnySchema, InferSchema, SchemaDefinition } from "./schema"

type HasTrue<TValue, TKey extends PropertyKey> =
  TValue extends Record<TKey, true> ? true : false

type HasDefault<TValue> = TValue extends { readonly default: unknown }
  ? true
  : false

type RequiredOnCreate<TSchema extends AnySchema> =
  HasTrue<TSchema, "outputOnly"> extends true
    ? false
    : HasTrue<TSchema, "nullable"> extends true
      ? false
      : HasDefault<TSchema> extends true
        ? false
        : true

interface PropertyMetadata extends SchemaDefinition {
  readonly _Value?: unknown
  immutable: boolean
  nullable: boolean
  outputOnly: boolean
  requiredOnCreate: boolean
}

export type PropertyDefinition = AnySchema extends infer TSchema
  ? TSchema extends AnySchema
    ? TSchema & PropertyMetadata
    : never
  : never

type NormalizedProperty<TSchema extends AnySchema> = TSchema extends AnySchema
  ? TSchema & {
      readonly _Value?: InferSchema<TSchema>
      immutable: HasTrue<TSchema, "immutable">
      nullable: HasTrue<TSchema, "nullable">
      outputOnly: HasTrue<TSchema, "outputOnly">
      requiredOnCreate: RequiredOnCreate<TSchema>
    }
  : never

export type Properties = Readonly<Record<string, PropertyDefinition>>

export type NormalizeProperties<TProperties extends Record<string, AnySchema>> =
  {
    readonly [TKey in keyof TProperties]: NormalizedProperty<TProperties[TKey]>
  }

export type InferProperty<TProperty extends PropertyDefinition> = Exclude<
  TProperty["_Value"],
  undefined
>

export type InferProperties<TProperties extends Properties> = {
  readonly [TKey in keyof TProperties]: InferProperty<TProperties[TKey]>
}

function normalizeProperty(property: AnySchema): PropertyDefinition {
  const metadata: SchemaDefinition = property
  const nullable = metadata.nullable === true
  const outputOnly = metadata.outputOnly === true
  const immutable = metadata.immutable === true
  const hasDefault = Object.hasOwn(metadata, "default")

  if (hasDefault && metadata.default === undefined) {
    throw new Error("A property default cannot be undefined.")
  }
  if (hasDefault && outputOnly) {
    throw new Error("An output-only property cannot declare an input default.")
  }

  return {
    ...property,
    immutable,
    nullable,
    outputOnly,
    requiredOnCreate: !outputOnly && !nullable && !hasDefault,
  }
}

export function normalizeProperties<
  const TProperties extends Readonly<Record<string, AnySchema>>,
>(properties: TProperties): NormalizeProperties<TProperties> {
  const normalized = Object.fromEntries(
    Object.entries(properties).map(([id, property]) => [
      id,
      normalizeProperty(property),
    ])
  )
  // SAFETY: the result preserves every source key and normalizes its corresponding schema.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return normalized as NormalizeProperties<TProperties>
}
