import type { DefinedObject } from "./object"
import {
  type AnySchema,
  type EnumSchema,
  type FileRef,
  type FileSchema,
  type ImageRef,
  type ImageSchema,
  type InferSchema,
  type Money,
  type NumberSchema,
  type RecordIdSchema,
  schema,
  type StringSchema,
} from "./schema"

export interface FieldOptions<TDefault = unknown> {
  defaultValue?: TDefault
  description?: string
  immutable?: boolean
  label?: string
  nullable?: boolean
  outputOnly?: boolean
  required?: boolean
}

export interface TextFieldOptions extends FieldOptions<string> {
  maxLength?: number
  minLength?: number
}

export interface NumberFieldOptions extends FieldOptions<number> {
  integer?: boolean
  maximum?: number
  minimum?: number
}

interface AssetFieldOptions<TDefault> extends FieldOptions<TDefault> {
  accept?: ReadonlyArray<string>
  maxBytes?: number
}

export interface FileFieldOptions extends AssetFieldOptions<FileRef> {}

export interface ImageFieldOptions extends AssetFieldOptions<ImageRef> {
  aspectRatio?: number
}

export interface Choice<TValue extends string = string> {
  label: string
  value: TValue
}

export interface FieldDefinition<
  TSchema extends AnySchema = AnySchema,
  TRequired extends boolean = boolean,
  TOutputOnly extends boolean = boolean,
  TImmutable extends boolean = boolean,
  TNullable extends boolean = boolean,
  TZero = unknown,
> {
  readonly _Value?: InferSchema<TSchema> | TZero
  accept?: ReadonlyArray<string>
  aspectRatio?: number
  defaultValue?: InferSchema<TSchema> | TZero
  description?: string
  immutable: TImmutable
  kind:
    | "date"
    | "domain"
    | "email"
    | "file"
    | "image"
    | "money"
    | "number"
    | "phone"
    | "reference"
    | "select"
    | "text"
    | "timestamp"
    | "url"
  label?: string
  maxBytes?: number
  nullable: TNullable
  options?: ReadonlyArray<Choice>
  outputOnly: TOutputOnly
  required: TRequired
  schema: TSchema
}

export type Fields = Readonly<Record<string, FieldDefinition>>

export type InferField<TField extends FieldDefinition> = NonNullable<
  TField["_Value"]
>

type IsRequired<TOptions> = TOptions extends { readonly required: true }
  ? true
  : false

type IsOutputOnly<TOptions> = TOptions extends { readonly outputOnly: true }
  ? true
  : false

type IsImmutable<TOptions> = TOptions extends { readonly immutable: true }
  ? true
  : false

type IsNullable<TOptions> = TOptions extends { readonly nullable: true }
  ? true
  : false

type EffectiveZero<TOptions, TZero> = TOptions extends {
  readonly nullable: true
}
  ? never
  : TOptions extends { readonly required: true }
    ? never
    : TZero

type ConfiguredField<
  TSchema extends AnySchema,
  TOptions,
  TZero = undefined,
> = FieldDefinition<
  TSchema,
  IsRequired<TOptions>,
  IsOutputOnly<TOptions>,
  IsImmutable<TOptions>,
  IsNullable<TOptions>,
  EffectiveZero<TOptions, TZero>
>

type DefaultField<
  TSchema extends AnySchema,
  TZero = undefined,
> = FieldDefinition<TSchema, false, false, false, false, TZero>

export type OutputFieldKeys<TFields extends Fields> = keyof TFields

type Simplify<TValue> = { [TKey in keyof TValue]: TValue[TKey] } & {}

type NumberValueSchemaOptions = Pick<
  NumberSchema,
  "integer" | "maximum" | "minimum"
>

type StringValueSchemaOptions = Pick<StringSchema, "maxLength" | "minLength">

export type InferFields<TFields extends Fields> = Simplify<{
  readonly [
    TKey in OutputFieldKeys<TFields>
  ]: TFields[TKey]["nullable"] extends true
    ? InferField<TFields[TKey]> | null
    : InferField<TFields[TKey]>
}>

function withMetadata<TField extends FieldDefinition>(
  definition: TField,
  options: FieldOptions
): TField {
  if (options.description !== undefined) {
    definition.description = options.description
  }
  if (options.label !== undefined) {
    definition.label = options.label
  }
  return definition
}

type FieldZeroValue = "" | 0

function createField<
  TSchema extends AnySchema,
  const TOptions extends FieldOptions,
>(
  kind: FieldDefinition["kind"],
  valueSchema: TSchema,
  options: TOptions,
  zeroValue: undefined
): ConfiguredField<TSchema, TOptions>
function createField<
  TSchema extends AnySchema,
  const TOptions extends FieldOptions,
  const TZero extends FieldZeroValue,
>(
  kind: FieldDefinition["kind"],
  valueSchema: TSchema,
  options: TOptions,
  zeroValue: TZero | undefined
): ConfiguredField<TSchema, TOptions, TZero>
function createField(
  kind: FieldDefinition["kind"],
  valueSchema: AnySchema,
  options: FieldOptions,
  zeroValue: FieldZeroValue | undefined
): FieldDefinition {
  const hasDefault = "defaultValue" in options
  const hasZero = zeroValue !== undefined

  if (hasDefault && options.defaultValue === undefined) {
    throw new Error("A field default cannot be undefined.")
  }
  if (hasDefault && options.required === true) {
    throw new Error(
      "A field cannot be both required input and server-defaulted."
    )
  }
  if (options.nullable === true && options.required === true) {
    throw new Error("A required field cannot be nullable.")
  }
  if (hasDefault && options.nullable === true) {
    throw new Error("A defaulted field cannot be nullable.")
  }
  if (options.outputOnly === true && options.required === true) {
    throw new Error("An output-only field cannot be required as input.")
  }
  if (hasDefault && options.outputOnly === true) {
    throw new Error("An output-only field cannot declare an input default.")
  }
  if (
    options.required !== true &&
    options.nullable !== true &&
    options.outputOnly !== true &&
    !hasDefault &&
    !hasZero
  ) {
    throw new Error(
      `Field kind '${kind}' has no zero value; declare required, nullable, defaultValue, or outputOnly.`
    )
  }

  const definition: FieldDefinition = {
    immutable: options.immutable === true,
    kind,
    nullable: options.nullable === true,
    outputOnly: options.outputOnly === true,
    required: options.required === true,
    schema: valueSchema,
  }
  if (hasDefault) {
    definition.defaultValue = options.defaultValue
  } else if (
    hasZero &&
    options.required !== true &&
    options.nullable !== true &&
    options.outputOnly !== true
  ) {
    definition.defaultValue = zeroValue
  }
  return withMetadata(definition, options)
}

function numberValueSchemaOptions(
  options: NumberFieldOptions
): NumberValueSchemaOptions {
  const schemaOptions: NumberValueSchemaOptions = {}
  if (options.integer !== undefined) schemaOptions.integer = options.integer
  if (options.maximum !== undefined) schemaOptions.maximum = options.maximum
  if (options.minimum !== undefined) schemaOptions.minimum = options.minimum
  return schemaOptions
}

function stringValueSchemaOptions(
  options: TextFieldOptions
): StringValueSchemaOptions {
  const schemaOptions: StringValueSchemaOptions = {}
  if (options.maxLength !== undefined)
    schemaOptions.maxLength = options.maxLength
  if (options.minLength !== undefined)
    schemaOptions.minLength = options.minLength
  return schemaOptions
}

function text(): DefaultField<StringSchema, "">
function text<const TOptions extends TextFieldOptions>(
  options: TOptions
): ConfiguredField<StringSchema, TOptions, "">
function text(options: TextFieldOptions = {}): FieldDefinition {
  return createField(
    "text",
    schema.string(stringValueSchemaOptions(options)),
    options,
    ""
  )
}

function email(): DefaultField<ReturnType<typeof schema.email>, "">
function email<const TOptions extends TextFieldOptions>(
  options: TOptions
): ConfiguredField<ReturnType<typeof schema.email>, TOptions, "">
function email(options: TextFieldOptions = {}): FieldDefinition {
  return createField(
    "email",
    schema.email(stringValueSchemaOptions(options)),
    options,
    ""
  )
}

function phone(): DefaultField<ReturnType<typeof schema.phone>, "">
function phone<const TOptions extends TextFieldOptions>(
  options: TOptions
): ConfiguredField<ReturnType<typeof schema.phone>, TOptions, "">
function phone(options: TextFieldOptions = {}): FieldDefinition {
  return createField(
    "phone",
    schema.phone(stringValueSchemaOptions(options)),
    options,
    ""
  )
}

function url(): DefaultField<ReturnType<typeof schema.url>, "">
function url<const TOptions extends TextFieldOptions>(
  options: TOptions
): ConfiguredField<ReturnType<typeof schema.url>, TOptions, "">
function url(options: TextFieldOptions = {}): FieldDefinition {
  return createField(
    "url",
    schema.url(stringValueSchemaOptions(options)),
    options,
    ""
  )
}

function domain(): DefaultField<ReturnType<typeof schema.domain>, "">
function domain<const TOptions extends TextFieldOptions>(
  options: TOptions
): ConfiguredField<ReturnType<typeof schema.domain>, TOptions, "">
function domain(options: TextFieldOptions = {}): FieldDefinition {
  return createField(
    "domain",
    schema.domain(stringValueSchemaOptions(options)),
    options,
    ""
  )
}

function date<const TOptions extends FieldOptions<string>>(
  options: TOptions
): ConfiguredField<ReturnType<typeof schema.date>, TOptions>
function date(options: FieldOptions<string>): FieldDefinition {
  return createField("date", schema.date(), options, undefined)
}

function timestamp<const TOptions extends FieldOptions<string>>(
  options: TOptions
): ConfiguredField<ReturnType<typeof schema.timestamp>, TOptions>
function timestamp(options: FieldOptions<string>): FieldDefinition {
  return createField("timestamp", schema.timestamp(), options, undefined)
}

function number(): DefaultField<ReturnType<typeof schema.number>, 0>
function number<const TOptions extends NumberFieldOptions>(
  options: TOptions
): ConfiguredField<ReturnType<typeof schema.number>, TOptions, 0>
function number(options: NumberFieldOptions = {}): FieldDefinition {
  if (
    options.defaultValue !== undefined &&
    ((options.minimum !== undefined &&
      options.defaultValue < options.minimum) ||
      (options.maximum !== undefined && options.defaultValue > options.maximum))
  ) {
    throw new Error("A number field default must satisfy its range.")
  }
  const zeroIsValid =
    (options.minimum === undefined || options.minimum <= 0) &&
    (options.maximum === undefined || options.maximum >= 0)
  return createField(
    "number",
    schema.number(numberValueSchemaOptions(options)),
    options,
    zeroIsValid ? 0 : undefined
  )
}

function money<const TOptions extends FieldOptions<Money>>(
  options: TOptions
): ConfiguredField<ReturnType<typeof schema.money>, TOptions>
function money(options: FieldOptions<Money>): FieldDefinition {
  return createField("money", schema.money(), options, undefined)
}

function file<const TOptions extends FileFieldOptions>(
  options: TOptions
): ConfiguredField<FileSchema, TOptions>
function file(options: FileFieldOptions): FieldDefinition {
  const definition = createField("file", schema.file(), options, undefined)
  if (options.accept !== undefined) definition.accept = options.accept
  if (options.maxBytes !== undefined) definition.maxBytes = options.maxBytes
  return definition
}

function image<const TOptions extends ImageFieldOptions>(
  options: TOptions
): ConfiguredField<ImageSchema, TOptions>
function image(options: ImageFieldOptions): FieldDefinition {
  if (options.aspectRatio !== undefined && options.aspectRatio <= 0) {
    throw new Error("Image aspect ratio must be greater than zero.")
  }

  const definition = createField("image", schema.image(), options, undefined)
  if (options.accept !== undefined) definition.accept = options.accept
  if (options.aspectRatio !== undefined)
    definition.aspectRatio = options.aspectRatio
  if (options.maxBytes !== undefined) definition.maxBytes = options.maxBytes
  return definition
}

interface SelectOptions<
  TChoices extends ReadonlyArray<Choice>,
> extends FieldOptions<TChoices[number]["value"]> {
  options: TChoices
}

type SelectField<TOptions extends SelectOptions<ReadonlyArray<Choice>>> =
  ConfiguredField<
    EnumSchema<TOptions["options"][number]["value"]>,
    TOptions
  > & {
    options: TOptions["options"]
  }

function select<const TOptions extends SelectOptions<ReadonlyArray<Choice>>>(
  options: TOptions
): SelectField<TOptions> {
  const values = options.options.map((option) => option.value)
  if (
    options.defaultValue !== undefined &&
    !values.includes(options.defaultValue)
  ) {
    throw new Error("A select field default must match one of its options.")
  }
  const definition = createField(
    "select",
    schema.enumeration(values),
    options,
    undefined
  )
  return Object.assign(definition, { options: options.options })
}

interface ReferenceOptions<
  TObject extends DefinedObject,
> extends FieldOptions<string> {
  object: TObject
}

function reference<
  const TObject extends DefinedObject,
  const TOptions extends ReferenceOptions<TObject>,
>(options: TOptions): ConfiguredField<RecordIdSchema<TObject["id"]>, TOptions> {
  return createField(
    "reference",
    schema.recordId(options.object),
    options,
    undefined
  )
}

export const field = {
  date,
  domain,
  email,
  file,
  image,
  money,
  number,
  phone,
  reference,
  select,
  text,
  timestamp,
  url,
}
