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
  defaultValue?: TValue
  description?: string
  immutable?: boolean
  label?: string
  nullable?: boolean
  outputOnly?: boolean
  required?: boolean
}

/** A portable value contract. Runtime integrations compile it to native schemas. */
export interface SchemaDefinition<T = unknown> {
  readonly _Type?: T
  defaultValue?: T
  description?: string
  immutable?: boolean
  kind: string
  label?: string
  nullable?: boolean
  outputOnly?: boolean
  required?: boolean
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

interface FileSchema extends SchemaDefinition<FileRef> {
  accept?: ReadonlyArray<string>
  kind: "file"
  maxBytes?: number
}

export interface ImageRef extends FileRef {
  alt?: string
}

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

export interface Choice<TValue extends string = string> {
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

export type RecordId<TObjectId extends string = string> = string &
  Brand.Brand<`RecordId:${TObjectId}`>

export function RecordId<const TObjectId extends string>(
  objectId: TObjectId
): Brand.Constructor<RecordId<TObjectId>> {
  return Brand.make<RecordId<TObjectId>>(
    (value) => value.length > 0 || `Expected a non-empty ${objectId} record ID`
  )
}

interface RecordIdSchema<
  TObjectId extends string = string,
> extends SchemaDefinition<RecordId<TObjectId>> {
  kind: "recordId"
  objectId: TObjectId
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
  | EnumSchema
  | FileSchema
  | ImageSchema
  | LiteralSchema
  | MapSchema
  | MoneySchema
  | NumberSchema
  | OptionalSchema
  | RecordIdSchema
  | StringSchema
  | StructSchema
  | UnionSchema

export interface StringSchemaOptions extends SchemaAnnotations<string> {
  maxLength?: number
  minLength?: number
}

type SemanticStringOptions<TValue extends string> = Omit<
  StringSchemaOptions,
  "defaultValue"
> &
  SchemaAnnotations<TValue>

export interface NumberSchemaOptions extends SchemaAnnotations<number> {
  integer?: boolean
  maximum?: number
  minimum?: number
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
  if (
    options?.defaultValue !== undefined &&
    !values.includes(options.defaultValue)
  ) {
    throw new Error("An enum default must match one of its values.")
  }
  return { kind: "enum", values, ...configured(options) }
}

interface SelectOptions<
  TChoices extends ReadonlyArray<Choice>,
> extends SchemaAnnotations<TChoices[number]["value"]> {
  options: TChoices
}

function select<const TChoices extends ReadonlyArray<Choice>>(
  options: SelectOptions<TChoices>
): EnumSchema<TChoices[number]["value"]> & SelectOptions<TChoices> {
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
    values.defaultValue !== undefined &&
    ((values.minimum !== undefined && values.defaultValue < values.minimum) ||
      (values.maximum !== undefined && values.defaultValue > values.maximum))
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
  const TObject extends { readonly id: string },
  const TOptions extends SchemaAnnotations<RecordId<TObject["id"]>> = {},
>(
  recordObject: TObject,
  options?: TOptions
): RecordIdSchema<TObject["id"]> & TOptions {
  return {
    kind: "recordId",
    objectId: recordObject.id,
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

export const schema = {
  array,
  boolean,
  date,
  domain,
  email,
  enumeration,
  file,
  image,
  literal,
  map,
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
