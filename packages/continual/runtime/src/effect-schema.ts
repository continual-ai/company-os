import { Schema } from "effect"

import type { DefinedError } from "./definition/error"
import type { FieldDefinition } from "./definition/field"
import type {
  DefinedObject,
  ObjectCreateInput,
  ObjectRecord,
  ObjectUpdateInput,
} from "./definition/object"
import type {
  AnySchema,
  InferSchema,
  NumberSchema,
  StringSchema,
} from "./definition/schema"
import { schema } from "./definition/schema"

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const domainPattern = /^(?!-)(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/
const phonePattern = /^\+?[0-9().\-\s]{7,}$/
const urlPattern = /^https?:\/\/[^\s]+$/
const datePattern = /^\d{4}-\d{2}-\d{2}$/
const timestampPattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/
const currencyPattern = /^[A-Z]{3}$/
const decimalPattern = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/

const fileRefSchema = Schema.Struct({
  assetId: Schema.String.check(Schema.isNonEmpty()),
}).annotate({ identifier: "FileRef", title: "File reference" })

const imageRefSchema = Schema.Struct({
  assetId: Schema.String.check(Schema.isNonEmpty()),
  alt: Schema.optionalKey(Schema.String),
}).annotate({ identifier: "ImageRef", title: "Image reference" })

const moneySchema = Schema.Struct({
  amount: Schema.String.check(
    Schema.isPattern(decimalPattern, {
      expected: "a decimal amount",
    })
  ).annotate({ format: "decimal", title: "Amount" }),
  currency: Schema.String.check(
    Schema.isPattern(currencyPattern, {
      expected: "an ISO 4217 currency code",
    })
  ).annotate({ title: "Currency code" }),
}).annotate({ identifier: "Money", title: "Money" })

const annotationsSchema = Schema.Record(Schema.String, Schema.String).annotate({
  default: {},
  identifier: "Annotations",
  title: "Annotations",
})

interface CompiledSchemaFields {
  [fieldId: PropertyKey]: Schema.Codec<unknown, unknown>
}

function entry<const TKey extends PropertyKey, TValue>(
  key: TKey,
  value: TValue
): readonly [TKey, TValue] {
  return [key, value]
}

function compileString(definition: StringSchema): Schema.Codec<string> {
  let value: Schema.Codec<string> = Schema.String

  if (definition.minLength !== undefined) {
    value = value.check(Schema.isMinLength(definition.minLength))
  }
  if (definition.maxLength !== undefined) {
    value = value.check(Schema.isMaxLength(definition.maxLength))
  }

  switch (definition.format) {
    case "date":
      return value
        .check(
          Schema.isPattern(datePattern, { expected: "an ISO calendar date" })
        )
        .annotate({ format: "date" })
    case "domain":
      return value
        .check(Schema.isPattern(domainPattern, { expected: "a domain name" }))
        .annotate({ format: "hostname" })
    case "email":
      return value
        .check(Schema.isPattern(emailPattern, { expected: "an email address" }))
        .annotate({ format: "email" })
    case "phone":
      return value
        .check(Schema.isPattern(phonePattern, { expected: "a phone number" }))
        .annotate({ format: "tel" })
    case "timestamp":
      return value
        .check(
          Schema.isPattern(timestampPattern, {
            expected: "an RFC 3339 timestamp",
          })
        )
        .annotate({ format: "date-time" })
    case "url":
      return value
        .check(
          Schema.isPattern(urlPattern, { expected: "an HTTP or HTTPS URL" })
        )
        .annotate({ format: "uri" })
  }

  return value
}

function compileNumber(definition: NumberSchema): Schema.Codec<number> {
  let value: Schema.Codec<number> = Schema.Number.check(Schema.isFinite())

  if (definition.integer) {
    value = value.check(Schema.isInt())
  }
  if (definition.minimum !== undefined) {
    value = value.check(Schema.isGreaterThanOrEqualTo(definition.minimum))
  }
  if (definition.maximum !== undefined) {
    value = value.check(Schema.isLessThanOrEqualTo(definition.maximum))
  }

  return value
}

function compile(definition: AnySchema): Schema.Codec<unknown, unknown> {
  switch (definition.kind) {
    case "array":
      return Schema.Array(compile(definition.items))
    case "boolean":
      return Schema.Boolean
    case "enum":
      return Schema.Literals(definition.values)
    case "file":
      return fileRefSchema
    case "image":
      return imageRefSchema
    case "literal":
      return definition.value === null
        ? Schema.Null
        : Schema.Literal(definition.value)
    case "map":
      return Schema.Record(Schema.String, compile(definition.values))
    case "money":
      return moneySchema
    case "number":
      return compileNumber(definition)
    case "optional":
      return Schema.optionalKey(compile(definition.value))
    case "recordId":
      return Schema.String.check(Schema.isNonEmpty()).annotate({
        expected: `a ${definition.objectId} record id`,
      })
    case "string":
      return compileString(definition)
    case "struct": {
      const fields: CompiledSchemaFields = Object.fromEntries(
        Object.entries(definition.fields).map(([id, member]) =>
          entry(id, compile(member))
        )
      )
      return Schema.Struct(fields)
    }
    case "union":
      return Schema.Union(definition.members.map(compile))
  }

  throw new Error("Unsupported schema kind.")
}

export function toEffectSchema<TSchema extends AnySchema>(
  definition: TSchema
): Schema.Codec<InferSchema<TSchema>, unknown>
export function toEffectSchema(
  definition: AnySchema
): Schema.Codec<unknown, unknown> {
  return compile(definition)
}

const compiledFieldSchemas = new WeakMap<
  FieldDefinition,
  Map<string, Schema.Codec<unknown, unknown>>
>()

function compileFieldValue(
  object: DefinedObject,
  fieldId: string,
  field: FieldDefinition
): Schema.Codec<unknown, unknown> {
  const identifier = `${pascalCase(object.id)}${pascalCase(fieldId)}`
  const cached = compiledFieldSchemas.get(field)?.get(identifier)
  if (cached !== undefined) return cached

  let value = compile(field.schema)
  const acceptsEmptyString =
    !field.required &&
    !field.nullable &&
    field.schema.kind === "string" &&
    field.kind !== "date" &&
    field.kind !== "timestamp"
  if (acceptsEmptyString) {
    value = Schema.Union([Schema.Literal(""), value])
  }
  if (field.nullable) {
    value = Schema.NullOr(value)
  }
  if (
    acceptsEmptyString ||
    field.nullable ||
    field.kind === "file" ||
    field.kind === "image" ||
    field.kind === "select"
  ) {
    value = value.annotate({ identifier })
  }
  if (field.label !== undefined) {
    value = value.annotate({ title: field.label })
  }
  const description = field.immutable
    ? [
        field.description,
        "Immutable after creation. Updates may repeat the current value but cannot change it.",
      ]
        .filter((part) => part !== undefined)
        .join(" ")
    : field.description
  if (description !== undefined) {
    value = value.annotate({ description })
  }
  if (field.defaultValue !== undefined) {
    value = value.annotate({ default: field.defaultValue })
  }
  if (field.outputOnly) {
    value = value.annotate({ readOnly: true })
  }
  const objectCache = compiledFieldSchemas.get(field) ?? new Map()
  objectCache.set(identifier, value)
  compiledFieldSchemas.set(field, objectCache)
  return value
}

function compileObjectFields(object: DefinedObject): CompiledSchemaFields {
  return Object.fromEntries(
    Object.entries(object.fields).map(([fieldId, field]) =>
      entry(fieldId, compileFieldValue(object, fieldId, field))
    )
  )
}

function compileCreateFields(object: DefinedObject): CompiledSchemaFields {
  return Object.fromEntries(
    Object.entries(object.fields)
      .filter(([, field]) => !field.outputOnly)
      .map(([fieldId, field]) =>
        entry(
          fieldId,
          field.required
            ? compileFieldValue(object, fieldId, field)
            : Schema.optionalKey(compileFieldValue(object, fieldId, field))
        )
      )
  )
}

function compileUpdateFields(object: DefinedObject): CompiledSchemaFields {
  return Object.fromEntries(
    Object.entries(object.fields)
      .filter(([, field]) => !field.outputOnly)
      .map(([fieldId, field]) =>
        entry(
          fieldId,
          Schema.optionalKey(compileFieldValue(object, fieldId, field))
        )
      )
  )
}

function annotateObjectSchema(
  object: DefinedObject,
  value: Schema.Codec<unknown, unknown>,
  title: string,
  identifier: string
): Schema.Codec<unknown, unknown> {
  value = value.annotate({ identifier, title })
  if (object.description !== undefined) {
    value = value.annotate({ description: object.description })
  }
  return value
}

function pascalCase(value: string): string {
  return value
    .replace(/(^|[^a-zA-Z0-9]+)([a-zA-Z0-9])/g, (_match, _prefix, char) =>
      char.toUpperCase()
    )
    .replace(/[^a-zA-Z0-9]/g, "")
}

export function toEffectObjectSchema<TObject extends DefinedObject>(
  object: TObject
): Schema.Codec<ObjectRecord<TObject>, unknown>
export function toEffectObjectSchema(
  object: DefinedObject
): Schema.Codec<unknown, unknown> {
  const id = Schema.String.check(Schema.isNonEmpty()).annotate({
    readOnly: true,
    title: `${object.name} ID`,
  })
  const createdAt = compile(schema.timestamp()).annotate({
    readOnly: true,
    title: "Created at",
  })
  const updatedAt = compile(schema.timestamp()).annotate({
    readOnly: true,
    title: "Updated at",
  })
  const actorId = Schema.String.check(Schema.isNonEmpty()).annotate({
    expected: "an actor id",
    readOnly: true,
  })
  const fields: CompiledSchemaFields = Object.fromEntries([
    entry("id", id),
    entry("annotations", annotationsSchema),
    entry("createdAt", createdAt),
    entry("createdById", actorId),
    entry(
      "etag",
      Schema.String.check(Schema.isNonEmpty()).annotate({ readOnly: true })
    ),
    entry("updatedAt", updatedAt),
    entry("updatedById", actorId),
    ...Object.entries(compileObjectFields(object)),
  ])
  return annotateObjectSchema(
    object,
    Schema.Struct(fields),
    object.name,
    pascalCase(object.id)
  )
}

export function toEffectObjectCreateSchema<TObject extends DefinedObject>(
  object: TObject
): Schema.Codec<ObjectCreateInput<TObject>, unknown>
export function toEffectObjectCreateSchema(
  object: DefinedObject
): Schema.Codec<unknown, unknown> {
  const fields: CompiledSchemaFields = {
    annotations: Schema.optionalKey(annotationsSchema),
    ...compileCreateFields(object),
  }
  return annotateObjectSchema(
    object,
    Schema.Struct(fields),
    `Create ${object.name}`,
    `${pascalCase(object.id)}CreateInput`
  )
}

export function toEffectObjectUpdateSchema<TObject extends DefinedObject>(
  object: TObject
): Schema.Codec<ObjectUpdateInput<TObject>, unknown>
export function toEffectObjectUpdateSchema(
  object: DefinedObject
): Schema.Codec<unknown, unknown> {
  const fields: CompiledSchemaFields = {
    annotations: Schema.optionalKey(annotationsSchema),
    ...compileUpdateFields(object),
  }
  return annotateObjectSchema(
    object,
    Schema.Struct(fields),
    `Update ${object.name}`,
    `${pascalCase(object.id)}UpdateInput`
  )
}

export function toEffectErrorSchema<TError extends DefinedError>(
  error: TError
): Schema.Codec<
  {
    readonly category: TError["category"]
    readonly code: TError["code"]
    readonly details: InferSchema<TError["details"]>
    readonly message: string
  },
  unknown
>
export function toEffectErrorSchema(
  error: DefinedError
): Schema.Codec<unknown, unknown> {
  let value = Schema.Struct({
    category: Schema.Literal(error.category),
    code: Schema.Literal(error.code),
    details: compile(error.details),
    message: Schema.String.check(Schema.isNonEmpty()),
  }).annotate({
    identifier: `${pascalCase(error.code)}Error`,
    title: error.name,
  })

  if (error.description !== undefined) {
    value = value.annotate({ description: error.description })
  }

  return value
}
