import type {
  AnySchema,
  InferSchema,
  NumberSchema,
  SchemaDefinition,
  StringSchema,
} from "./schema"

type HasTrue<TValue, TKey extends PropertyKey> =
  TValue extends Record<TKey, true> ? true : false

type DefaultZero<TSchema extends AnySchema> = TSchema extends NumberSchema
  ? 0
  : TSchema extends StringSchema
    ? TSchema["format"] extends "date" | "timestamp"
      ? undefined
      : ""
    : undefined

type EffectiveZero<TSchema extends AnySchema> =
  HasTrue<TSchema, "nullable"> extends true
    ? undefined
    : HasTrue<TSchema, "required"> extends true
      ? undefined
      : TSchema extends { readonly defaultValue: unknown }
        ? undefined
        : DefaultZero<TSchema>

interface PropertyMetadata extends SchemaDefinition {
  readonly _Value?: unknown
  immutable: boolean
  nullable: boolean
  outputOnly: boolean
  required: boolean
}

export type PropertyDefinition = AnySchema extends infer TSchema
  ? TSchema extends AnySchema
    ? TSchema & PropertyMetadata
    : never
  : never

type NormalizedProperty<TSchema extends AnySchema> = TSchema extends AnySchema
  ? TSchema & {
      readonly _Value?: InferSchema<TSchema> | EffectiveZero<TSchema>
      immutable: HasTrue<TSchema, "immutable">
      nullable: HasTrue<TSchema, "nullable">
      outputOnly: HasTrue<TSchema, "outputOnly">
      required: HasTrue<TSchema, "required">
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

function zeroValue(property: AnySchema): "" | 0 | undefined {
  if (property.kind === "number") return 0
  if (
    property.kind === "string" &&
    property.format !== "date" &&
    property.format !== "timestamp"
  ) {
    return ""
  }
  return undefined
}

function normalizeProperty(property: AnySchema): PropertyDefinition {
  const metadata: SchemaDefinition = property
  const required = metadata.required === true
  const nullable = metadata.nullable === true
  const outputOnly = metadata.outputOnly === true
  const immutable = metadata.immutable === true
  const hasDefault = metadata.defaultValue !== undefined
  const zero = zeroValue(property)

  if (hasDefault && required) {
    throw new Error(
      "A property cannot be both required input and server-defaulted."
    )
  }
  if (nullable && required) {
    throw new Error("A required property cannot be nullable.")
  }
  if (hasDefault && nullable) {
    throw new Error("A defaulted property cannot be nullable.")
  }
  if (outputOnly && required) {
    throw new Error("An output-only property cannot be required as input.")
  }
  if (hasDefault && outputOnly) {
    throw new Error("An output-only property cannot declare an input default.")
  }
  if (
    !required &&
    !nullable &&
    !outputOnly &&
    !hasDefault &&
    zero === undefined
  ) {
    throw new Error(
      `Schema kind '${property.kind}' has no zero value; declare required, nullable, defaultValue, or outputOnly.`
    )
  }

  const normalized: PropertyDefinition = {
    ...property,
    immutable,
    nullable,
    outputOnly,
    required,
  }
  if (
    !hasDefault &&
    !required &&
    !nullable &&
    !outputOnly &&
    zero !== undefined
  ) {
    normalized.defaultValue = zero
  }
  return normalized
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
