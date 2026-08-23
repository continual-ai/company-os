import { Brand } from "effect"

import { definitionId } from "./identity"

export type LiteralValue = boolean | null | number | string

const datePattern = /^\d{4}-\d{2}-\d{2}$/
const domainPattern = /^(?!-)(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const phonePattern = /^\+?[0-9().\-\s]{7,}$/
const timestampPattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/
const urlPattern = /^https?:\/\/[^\s]+$/
const currencyPattern = /^[A-Z]{3}$/
const decimalPattern = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/

export const MAX_RECORD_ALIAS_LENGTH = 500 as const

export type CalendarDate = string & Brand.Brand<"CalendarDate">
export const CalendarDate = Brand.make<CalendarDate>(
  (value) =>
    datePattern.test(value) || `Expected '${value}' to be an ISO calendar date`
)

export type CurrencyCode = string & Brand.Brand<"CurrencyCode">
export const CurrencyCode = Brand.make<CurrencyCode>(
  (value) =>
    currencyPattern.test(value) ||
    `Expected '${value}' to be an ISO 4217 currency code`
)

export type Decimal = string & Brand.Brand<"Decimal">
export const Decimal = Brand.make<Decimal>(
  (value) =>
    decimalPattern.test(value) || `Expected '${value}' to be a decimal amount`
)

export type DomainName = string & Brand.Brand<"DomainName">
export const DomainName = Brand.make<DomainName>(
  (value) =>
    domainPattern.test(value) || `Expected '${value}' to be a domain name`
)

export type EmailAddress = string & Brand.Brand<"EmailAddress">
export const EmailAddress = Brand.make<EmailAddress>(
  (value) =>
    emailPattern.test(value) || `Expected '${value}' to be an email address`
)

export type PhoneNumber = string & Brand.Brand<"PhoneNumber">
export const PhoneNumber = Brand.make<PhoneNumber>(
  (value) =>
    phonePattern.test(value) || `Expected '${value}' to be a phone number`
)

const recordAliasPattern = /^[a-z][a-z0-9_-]*:\S+$/

/** Opaque, globally qualified alternate identifier for a record. */
export type RecordAlias = string & Brand.Brand<"RecordAlias">
export const RecordAlias = Brand.make<RecordAlias>((value) =>
  !recordAliasPattern.test(value)
    ? `Expected '${value}' to be a qualified record alias such as 'system:default-agent'`
    : value.length <= MAX_RECORD_ALIAS_LENGTH ||
      `Expected a record alias no longer than ${MAX_RECORD_ALIAS_LENGTH} characters`
)

export function isRecordAlias(value: string): value is RecordAlias {
  return value.includes(":")
}

export type Timestamp = string & Brand.Brand<"Timestamp">
export const Timestamp = Brand.make<Timestamp>(
  (value) =>
    timestampPattern.test(value) ||
    `Expected '${value}' to be an RFC 3339 timestamp`
)

export type WebUrl = string & Brand.Brand<"WebUrl">
export const WebUrl = Brand.make<WebUrl>(
  (value) =>
    urlPattern.test(value) || `Expected '${value}' to be an HTTP or HTTPS URL`
)

/** Metadata shared by object properties, action inputs, forms, and protocols. */
export interface SchemaAnnotations<TValue = unknown> {
  default?: TValue
  description?: string
  immutable?: boolean
  label?: string
  nullable?: boolean
  outputOnly?: boolean
}

/** A portable value contract. Runtime integrations compile it to native schemas. */
export interface SchemaDefinition<T = unknown> extends SchemaAnnotations<T> {
  readonly _Type?: T
  kind: string
}

type SchemaValue<TSchema extends SchemaDefinition> = Exclude<
  TSchema["_Type"],
  undefined
>

export type InferSchema<TSchema extends AnySchema> =
  TSchema["nullable"] extends true
    ? SchemaValue<TSchema> | null
    : SchemaValue<TSchema>

interface ArraySchema<
  TItem extends AnySchema = AnySchema,
> extends SchemaDefinition<ReadonlyArray<InferSchema<TItem>>> {
  items: TItem
  kind: "array"
}

interface BooleanSchema extends SchemaDefinition<boolean> {
  kind: "boolean"
}

export interface FileRef {
  assetId: string
}

export interface MediaRef extends FileRef {
  alt?: string
}

interface FileSchema extends SchemaDefinition<FileRef> {
  accept?: ReadonlyArray<string>
  kind: "file"
  maxBytes?: number
}

export interface ImageRef extends MediaRef {}

export interface ImageSchema extends SchemaDefinition<ImageRef> {
  accept?: ReadonlyArray<string>
  aspectRatio?: number
  kind: "image"
  maxBytes?: number
}

interface LiteralSchema<
  TValue extends LiteralValue = LiteralValue,
> extends SchemaDefinition<TValue> {
  kind: "literal"
  value: TValue
}

export interface Money {
  amount: Decimal
  currency: CurrencyCode
}

interface MoneySchema extends SchemaDefinition<Money> {
  kind: "money"
}

export interface DecimalSchema extends SchemaDefinition<Decimal> {
  kind: "decimal"
  precision?: number
  scale?: number
}

export interface GeoPoint {
  latitude: number
  longitude: number
}

export interface GeoPointSchema extends SchemaDefinition<GeoPoint> {
  kind: "geoPoint"
}

export interface MediaSchema extends SchemaDefinition<MediaRef> {
  accept?: ReadonlyArray<string>
  kind: "media"
  maxBytes?: number
}

export type ChoiceColor =
  | "blue"
  | "cyan"
  | "gray"
  | "green"
  | "indigo"
  | "lime"
  | "orange"
  | "pink"
  | "purple"
  | "red"
  | "teal"
  | "violet"
  | "yellow"

export interface Choice<TValue extends string = string> {
  /** Portable semantic presentation; interfaces decide how to render it. */
  color?: ChoiceColor
  icon?: string
  label: string
  value: TValue
}

export interface EnumSchema<
  TValue extends string = string,
> extends SchemaDefinition<TValue> {
  kind: "enum"
  options?: ReadonlyArray<Choice<TValue>>
  values: ReadonlyArray<TValue>
}

export interface NumberSchema extends SchemaDefinition<number> {
  integer?: boolean
  kind: "number"
  maximum?: number
  minimum?: number
}

interface OptionalSchema<
  TValue extends AnySchema = AnySchema,
> extends SchemaDefinition<InferSchema<TValue> | undefined> {
  kind: "optional"
  value: TValue
}

export type RecordId<TTypeId extends string = string> = string &
  Brand.Brand<`RecordId:${TTypeId}`>

export function RecordId<const TTypeId extends string>(
  typeId: TTypeId
): Brand.Constructor<RecordId<TTypeId>> {
  return Brand.make<RecordId<TTypeId>>(
    (value) =>
      (value.length > 0 && !value.includes(":")) ||
      `Expected a non-empty ${typeId} record ID without ':'`
  )
}

type RecordIds<TTypeId extends string> = TTypeId extends string
  ? RecordId<TTypeId>
  : never

/** Canonical ID or globally qualified alias accepted at public input boundaries. */
export type RecordIdentifier<TTypeId extends string = string> =
  | RecordIds<TTypeId>
  | RecordAlias

export interface RecordIdSchema<
  TTargetTypeId extends string = string,
  TRecordTypeId extends string = TTargetTypeId,
> extends SchemaDefinition<RecordIds<TRecordTypeId>> {
  kind: "recordId"
  typeId: TTargetTypeId
}

export interface StringSchema<
  TValue extends string = string,
> extends SchemaDefinition<TValue> {
  format?: "date" | "domain" | "email" | "phone" | "timestamp" | "url"
  kind: "string"
  maxLength?: number
  minLength?: number
}

export type SchemaProperties = Readonly<Record<string, AnySchema>>

interface MapSchema<
  TValue extends AnySchema = AnySchema,
> extends SchemaDefinition<Readonly<Record<string, InferSchema<TValue>>>> {
  kind: "map"
  values: TValue
}

type OptionalKeys<TProperties extends SchemaProperties> = {
  [TKey in keyof TProperties]: TProperties[TKey] extends OptionalSchema
    ? TKey
    : never
}[keyof TProperties]

type RequiredKeys<TProperties extends SchemaProperties> = Exclude<
  keyof TProperties,
  OptionalKeys<TProperties>
>

type Simplify<TValue> = { [TKey in keyof TValue]: TValue[TKey] } & {}

type InferStruct<TProperties extends SchemaProperties> = Simplify<
  {
    readonly [TKey in RequiredKeys<TProperties>]: InferSchema<TProperties[TKey]>
  } & {
    readonly [TKey in OptionalKeys<TProperties>]?: Exclude<
      InferSchema<TProperties[TKey]>,
      undefined
    >
  }
>

export interface StructSchema<
  TProperties extends SchemaProperties = SchemaProperties,
> extends SchemaDefinition<InferStruct<TProperties>> {
  kind: "struct"
  properties: TProperties
}

interface UnionSchema<
  TMembers extends ReadonlyArray<AnySchema> = ReadonlyArray<AnySchema>,
> extends SchemaDefinition<InferSchema<TMembers[number]>> {
  kind: "union"
  members: TMembers
}

export type AnySchema =
  | ArraySchema
  | BooleanSchema
  | DecimalSchema
  | EnumSchema
  | FileSchema
  | GeoPointSchema
  | ImageSchema
  | LiteralSchema
  | MapSchema
  | MediaSchema
  | MoneySchema
  | NumberSchema
  | OptionalSchema
  | RecordIdSchema
  | StringSchema
  | StructSchema
  | UnionSchema

type InputSchemaValue<TSchema extends AnySchema> =
  TSchema extends RecordIdSchema<string, infer TRecordTypeId>
    ? RecordIdentifier<TRecordTypeId>
    : TSchema extends ArraySchema<infer TItem>
      ? ReadonlyArray<InferInputSchema<TItem>>
      : TSchema extends MapSchema<infer TValue>
        ? Readonly<Record<string, InferInputSchema<TValue>>>
        : TSchema extends OptionalSchema<infer TValue>
          ? InferInputSchema<TValue>
          : TSchema extends StructSchema<infer TProperties>
            ? Simplify<
                {
                  readonly [
                    TKey in RequiredKeys<TProperties>
                  ]: InferInputSchema<TProperties[TKey]>
                } & {
                  readonly [
                    TKey in OptionalKeys<TProperties>
                  ]?: InferInputSchema<TProperties[TKey]>
                }
              >
            : TSchema extends UnionSchema<infer TMembers>
              ? InferInputSchema<TMembers[number]>
              : SchemaValue<TSchema>

/** Input value inferred from a schema, widening record IDs to aliases. */
export type InferInputSchema<TSchema extends AnySchema> =
  TSchema["nullable"] extends true
    ? InputSchemaValue<TSchema> | null
    : InputSchemaValue<TSchema>

export interface StringSchemaOptions extends SchemaAnnotations<string> {
  maxLength?: number
  minLength?: number
}

type SemanticStringOptions<TValue extends string> = Omit<
  StringSchemaOptions,
  "default"
> &
  SchemaAnnotations<TValue>

export interface NumberSchemaOptions extends SchemaAnnotations<number> {
  integer?: boolean
  maximum?: number
  minimum?: number
}

export interface DecimalSchemaOptions extends SchemaAnnotations<Decimal> {
  precision?: number
  scale?: number
}

interface FileSchemaOptions extends SchemaAnnotations<FileRef> {
  accept?: ReadonlyArray<string>
  maxBytes?: number
}

interface ImageSchemaOptions extends SchemaAnnotations<ImageRef> {
  accept?: ReadonlyArray<string>
  aspectRatio?: number
  maxBytes?: number
}

interface MediaSchemaOptions extends SchemaAnnotations<MediaRef> {
  accept?: ReadonlyArray<string>
  maxBytes?: number
}

function assertRange(
  label: string,
  minimum: number | undefined,
  maximum: number | undefined
): void {
  if (minimum !== undefined && maximum !== undefined && minimum > maximum) {
    throw new Error(`${label} minimum cannot be greater than its maximum.`)
  }
}

function configured<TOptions extends object>(
  options: TOptions | undefined
): TOptions {
  if (options !== undefined) return options
  // SAFETY: callers constrain TOptions to option bags whose properties are all optional.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return {} as TOptions
}

function array<
  TItem extends AnySchema,
  const TOptions extends SchemaAnnotations<ReadonlyArray<InferSchema<TItem>>> =
    {},
>(items: TItem, options?: TOptions): ArraySchema<TItem> & TOptions {
  return { kind: "array", items, ...configured(options) }
}

function boolean<const TOptions extends SchemaAnnotations<boolean> = {}>(
  options?: TOptions
): BooleanSchema & TOptions {
  return { kind: "boolean", ...configured(options) }
}

function decimal<const TOptions extends DecimalSchemaOptions = {}>(
  options?: TOptions
): DecimalSchema & TOptions {
  const values = configured(options)
  if (
    values.precision !== undefined &&
    (!Number.isInteger(values.precision) || values.precision <= 0)
  ) {
    throw new Error("Decimal precision must be a positive integer.")
  }
  if (
    values.scale !== undefined &&
    (!Number.isInteger(values.scale) || values.scale < 0)
  ) {
    throw new Error("Decimal scale must be a non-negative integer.")
  }
  if (
    values.precision !== undefined &&
    values.scale !== undefined &&
    values.scale > values.precision
  ) {
    throw new Error("Decimal scale cannot exceed its precision.")
  }
  return { kind: "decimal", ...values }
}

function literal<const TValue extends LiteralValue>(
  value: TValue
): LiteralSchema<TValue> {
  return { kind: "literal", value }
}

function file<const TOptions extends FileSchemaOptions = {}>(
  options?: TOptions
): FileSchema & TOptions {
  if (options?.maxBytes !== undefined && options.maxBytes <= 0) {
    throw new Error("A file maximum size must be greater than zero.")
  }
  return { kind: "file", ...configured(options) }
}

function image<const TOptions extends ImageSchemaOptions = {}>(
  options?: TOptions
): ImageSchema & TOptions {
  if (options?.aspectRatio !== undefined && options.aspectRatio <= 0) {
    throw new Error("An image aspect ratio must be greater than zero.")
  }
  if (options?.maxBytes !== undefined && options.maxBytes <= 0) {
    throw new Error("An image maximum size must be greater than zero.")
  }
  return { kind: "image", ...configured(options) }
}

function geoPoint<const TOptions extends SchemaAnnotations<GeoPoint> = {}>(
  options?: TOptions
): GeoPointSchema & TOptions {
  return { kind: "geoPoint", ...configured(options) }
}

function media<const TOptions extends MediaSchemaOptions = {}>(
  options?: TOptions
): MediaSchema & TOptions {
  if (options?.maxBytes !== undefined && options.maxBytes <= 0) {
    throw new Error("A media maximum size must be greater than zero.")
  }
  return { kind: "media", ...configured(options) }
}

function enumeration<
  const TValue extends string,
  const TOptions extends SchemaAnnotations<TValue> = {},
>(
  values: ReadonlyArray<TValue>,
  options?: TOptions
): EnumSchema<TValue> & TOptions {
  if (values.length === 0) throw new Error("Enums require at least one value.")
  const duplicate = values.find(
    (value, index) => values.indexOf(value) !== index
  )
  if (duplicate) {
    throw new Error(`Enum value '${duplicate}' is registered more than once.`)
  }
  if (options?.default !== undefined && !values.includes(options.default)) {
    throw new Error("An enum default must match one of its values.")
  }
  return { kind: "enum", values, ...configured(options) }
}

interface SelectOptions<
  TChoices extends ReadonlyArray<Choice>,
> extends SchemaAnnotations<TChoices[number]["value"]> {
  options: TChoices
}

function select<const TOptions extends SelectOptions<ReadonlyArray<Choice>>>(
  options: TOptions
): EnumSchema<TOptions["options"][number]["value"]> & TOptions {
  const values = options.options.map((option) => option.value)
  const definition = enumeration(values, options)
  return { ...definition, options: options.options }
}

function money<const TOptions extends SchemaAnnotations<Money> = {}>(
  options?: TOptions
): MoneySchema & TOptions {
  return { kind: "money", ...configured(options) }
}

function map<
  TValue extends AnySchema,
  const TOptions extends SchemaAnnotations<
    Readonly<Record<string, InferSchema<TValue>>>
  > = {},
>(values: TValue, options?: TOptions): MapSchema<TValue> & TOptions {
  return { kind: "map", values, ...configured(options) }
}

function number<const TOptions extends NumberSchemaOptions = {}>(
  options?: TOptions
): NumberSchema & TOptions {
  const values = configured(options)
  assertRange("Number", values.minimum, values.maximum)
  if (
    values.default !== undefined &&
    ((values.minimum !== undefined && values.default < values.minimum) ||
      (values.maximum !== undefined && values.default > values.maximum))
  ) {
    throw new Error("A number default must satisfy its range.")
  }
  return { kind: "number", ...values }
}

function object<
  const TProperties extends SchemaProperties,
  const TOptions extends SchemaAnnotations<InferStruct<TProperties>> = {},
>(
  properties: TProperties,
  options?: TOptions
): StructSchema<TProperties> & TOptions {
  for (const propertyId of Object.keys(properties)) definitionId(propertyId)
  return {
    kind: "struct",
    properties,
    ...configured(options),
  }
}

function optional<TValue extends AnySchema>(
  value: TValue
): OptionalSchema<TValue> {
  return { kind: "optional", value }
}

function recordId<
  const TType extends { readonly id: string },
  const TOptions extends SchemaAnnotations<RecordIds<TType["id"]>> = {},
>(
  targetType: TType,
  options?: TOptions
): RecordIdSchema<TType["id"]> & TOptions {
  return {
    kind: "recordId",
    typeId: targetType.id,
    ...configured(options),
  }
}

function string<const TOptions extends StringSchemaOptions = {}>(
  options?: TOptions
): StringSchema & TOptions {
  const values = configured(options)
  assertRange("String length", values.minLength, values.maxLength)
  return { kind: "string", ...values }
}

function semanticString<
  TValue extends string,
  const TOptions extends SemanticStringOptions<TValue> = {},
>(
  format: NonNullable<StringSchema["format"]>,
  options?: TOptions
): StringSchema<TValue> & TOptions {
  const values = configured(options)
  assertRange("String length", values.minLength, values.maxLength)
  return { kind: "string", format, ...values }
}

function date<const TOptions extends SemanticStringOptions<CalendarDate> = {}>(
  options?: TOptions
): StringSchema<CalendarDate> & TOptions {
  return semanticString("date", options)
}

function domain<const TOptions extends SemanticStringOptions<DomainName> = {}>(
  options?: TOptions
): StringSchema<DomainName> & TOptions {
  return semanticString("domain", options)
}

function email<const TOptions extends SemanticStringOptions<EmailAddress> = {}>(
  options?: TOptions
): StringSchema<EmailAddress> & TOptions {
  return semanticString("email", options)
}

function phone<const TOptions extends SemanticStringOptions<PhoneNumber> = {}>(
  options?: TOptions
): StringSchema<PhoneNumber> & TOptions {
  return semanticString("phone", options)
}

function timestamp<const TOptions extends SchemaAnnotations<Timestamp> = {}>(
  options?: TOptions
): StringSchema<Timestamp> & TOptions {
  return semanticString("timestamp", options)
}

function url<const TOptions extends SemanticStringOptions<WebUrl> = {}>(
  options?: TOptions
): StringSchema<WebUrl> & TOptions {
  return semanticString("url", options)
}

function union<
  const TMembers extends readonly [AnySchema, ...Array<AnySchema>],
>(members: TMembers): UnionSchema<TMembers> {
  return { kind: "union", members }
}

/** Portable schema builders shared by object properties and action values. */
export const schema = {
  array,
  boolean,
  date,
  decimal,
  domain,
  email,
  enumeration,
  file,
  geoPoint,
  image,
  literal,
  map,
  media,
  money,
  number,
  object,
  optional,
  phone,
  recordId,
  select,
  string,
  timestamp,
  union,
  url,
}
