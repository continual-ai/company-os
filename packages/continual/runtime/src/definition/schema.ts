import { definitionId } from "./identity"
import type { DefinedObject } from "./object"

export type LiteralValue = boolean | null | number | string

export type CalendarDate = string & { readonly _CalendarDate: true }
export type CurrencyCode = string & { readonly _CurrencyCode: true }
export type Decimal = string & { readonly _Decimal: true }
export type DomainName = string & { readonly _DomainName: true }
export type EmailAddress = string & { readonly _EmailAddress: true }
export type PhoneNumber = string & { readonly _PhoneNumber: true }
export type Timestamp = string & { readonly _Timestamp: true }
export type WebUrl = string & { readonly _WebUrl: true }

/** A portable value contract. Runtime integrations compile this to their native schema type. */
export interface SchemaDefinition<T = unknown> {
  readonly _Type?: T
  readonly kind: string
}

export type InferSchema<TSchema extends AnySchema> = Exclude<
  TSchema["_Type"],
  undefined
>

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

export interface FileSchema extends SchemaDefinition<FileRef> {
  kind: "file"
}

export interface ImageRef extends FileRef {
  alt?: string
}

export interface ImageSchema extends SchemaDefinition<ImageRef> {
  kind: "image"
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

export interface EnumSchema<
  TValue extends string = string,
> extends SchemaDefinition<TValue> {
  kind: "enum"
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

export type RecordId<TObjectId extends string = string> = string & {
  readonly _ObjectId: TObjectId
}

export interface RecordIdSchema<
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

type SchemaFields = Readonly<Record<string, AnySchema>>

interface MapSchema<
  TValue extends AnySchema = AnySchema,
> extends SchemaDefinition<Readonly<Record<string, InferSchema<TValue>>>> {
  kind: "map"
  values: TValue
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

type OptionalKeys<TFields extends SchemaFields> = {
  [TKey in keyof TFields]: TFields[TKey] extends OptionalSchema ? TKey : never
}[keyof TFields]

type RequiredKeys<TFields extends SchemaFields> = Exclude<
  keyof TFields,
  OptionalKeys<TFields>
>

type Simplify<TValue> = { [TKey in keyof TValue]: TValue[TKey] } & {}

type InferStruct<TFields extends SchemaFields> = Simplify<
  {
    readonly [TKey in RequiredKeys<TFields>]: InferSchema<TFields[TKey]>
  } & {
    readonly [TKey in OptionalKeys<TFields>]?: Exclude<
      InferSchema<TFields[TKey]>,
      undefined
    >
  }
>

interface StructSchema<
  TFields extends SchemaFields = SchemaFields,
> extends SchemaDefinition<InferStruct<TFields>> {
  fields: TFields
  kind: "struct"
}

interface UnionSchema<
  TMembers extends ReadonlyArray<AnySchema> = ReadonlyArray<AnySchema>,
> extends SchemaDefinition<InferSchema<TMembers[number]>> {
  kind: "union"
  members: TMembers
}

interface StringSchemaOptions {
  maxLength?: number
  minLength?: number
}

interface NumberSchemaOptions {
  integer?: boolean
  maximum?: number
  minimum?: number
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

function array<TItem extends AnySchema>(items: TItem): ArraySchema<TItem> {
  return { kind: "array", items }
}

function boolean(): BooleanSchema {
  return { kind: "boolean" }
}

function literal<const TValue extends LiteralValue>(
  value: TValue
): LiteralSchema<TValue> {
  return { kind: "literal", value }
}

function file(): FileSchema {
  return { kind: "file" }
}

function image(): ImageSchema {
  return { kind: "image" }
}

function enumeration<TValue extends string>(
  values: ReadonlyArray<TValue>
): EnumSchema<TValue> {
  if (values.length === 0) {
    throw new Error("Enums require at least one value.")
  }

  const duplicate = values.find(
    (value, index) => values.indexOf(value) !== index
  )
  if (duplicate) {
    throw new Error(`Enum value '${duplicate}' is registered more than once.`)
  }

  return { kind: "enum", values }
}

function money(): MoneySchema {
  return { kind: "money" }
}

function map<TValue extends AnySchema>(values: TValue): MapSchema<TValue> {
  return { kind: "map", values }
}

function number(options: NumberSchemaOptions = {}): NumberSchema {
  assertRange("Number", options.minimum, options.maximum)
  const definition: NumberSchema = { kind: "number" }
  if (options.integer !== undefined) definition.integer = options.integer
  if (options.maximum !== undefined) definition.maximum = options.maximum
  if (options.minimum !== undefined) definition.minimum = options.minimum
  return definition
}

function object<const TFields extends SchemaFields>(
  fields: TFields
): StructSchema<TFields> {
  for (const fieldId of Object.keys(fields)) {
    definitionId(fieldId)
  }

  return { kind: "struct", fields }
}

function optional<TValue extends AnySchema>(
  value: TValue
): OptionalSchema<TValue> {
  return { kind: "optional", value }
}

function recordId<const TObject extends DefinedObject>(
  recordObject: TObject
): RecordIdSchema<TObject["id"]> {
  return { kind: "recordId", objectId: recordObject.id }
}

function string(options: StringSchemaOptions = {}): StringSchema {
  assertRange("String length", options.minLength, options.maxLength)
  const definition: StringSchema = { kind: "string" }
  if (options.maxLength !== undefined) definition.maxLength = options.maxLength
  if (options.minLength !== undefined) definition.minLength = options.minLength
  return definition
}

function semanticString<TValue extends string>(
  format: NonNullable<StringSchema["format"]>,
  options: StringSchemaOptions = {}
): StringSchema<TValue> {
  assertRange("String length", options.minLength, options.maxLength)
  const definition: StringSchema<TValue> = { kind: "string", format }
  if (options.maxLength !== undefined) definition.maxLength = options.maxLength
  if (options.minLength !== undefined) definition.minLength = options.minLength
  return definition
}

function date(options: StringSchemaOptions = {}): StringSchema<CalendarDate> {
  return semanticString("date", options)
}

function domain(options: StringSchemaOptions = {}): StringSchema<DomainName> {
  return semanticString("domain", options)
}

function email(options: StringSchemaOptions = {}): StringSchema<EmailAddress> {
  return semanticString("email", options)
}

function phone(options: StringSchemaOptions = {}): StringSchema<PhoneNumber> {
  return semanticString("phone", options)
}

function timestamp(): StringSchema<Timestamp> {
  return semanticString("timestamp")
}

function url(options: StringSchemaOptions = {}): StringSchema<WebUrl> {
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
  string,
  timestamp,
  union,
  url,
}
