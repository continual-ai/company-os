import { Schema } from "effect"

import type { ErrorType } from "./definition/error"
import {
  ActorId,
  Etag,
  type ObjectRecord,
  type ObjectType,
} from "./definition/object"
import type { PropertyDefinition } from "./definition/property"
import type {
  AnySchema,
  DecimalSchema,
  InferSchema,
  NumberSchema,
  RecordIdentifier,
  SchemaDefinition,
  StringSchema,
} from "./definition/schema"
import {
  CalendarDate,
  CurrencyCode,
  Decimal,
  DomainName,
  EmailAddress,
  RecordAlias,
  PhoneNumber,
  RecordId,
  Timestamp,
  WebUrl,
} from "./definition/schema"

const fileRefSchema = Schema.Struct({
  assetId: Schema.String.check(Schema.isNonEmpty()),
}).annotate({ identifier: "FileRef", title: "File reference" })

const imageRefSchema = Schema.Struct({
  assetId: Schema.String.check(Schema.isNonEmpty()),
  alt: Schema.optionalKey(Schema.String),
}).annotate({ identifier: "ImageRef", title: "Image reference" })

const mediaRefSchema = Schema.Struct({
  assetId: Schema.String.check(Schema.isNonEmpty()),
  alt: Schema.optionalKey(Schema.String),
}).annotate({ identifier: "MediaRef", title: "Media reference" })

const geoPointSchema = Schema.Struct({
  latitude: Schema.Number.check(
    Schema.isFinite(),
    Schema.isGreaterThanOrEqualTo(-90),
    Schema.isLessThanOrEqualTo(90)
  ),
  longitude: Schema.Number.check(
    Schema.isFinite(),
    Schema.isGreaterThanOrEqualTo(-180),
    Schema.isLessThanOrEqualTo(180)
  ),
}).annotate({ identifier: "GeoPoint", title: "Geographic point" })

const moneySchema = Schema.Struct({
  amount: Schema.String.annotate({
    format: "decimal",
    title: "Amount",
  }).pipe(Schema.fromBrand("Decimal", Decimal)),
  currency: Schema.String.annotate({ title: "Currency code" }).pipe(
    Schema.fromBrand("CurrencyCode", CurrencyCode)
  ),
}).annotate({ identifier: "Money", title: "Money" })

const annotationsSchema = Schema.Record(Schema.String, Schema.String).annotate({
  default: {},
  identifier: "Annotations",
  title: "Annotations",
})

const recordAliasSchema = Schema.String.pipe(
  Schema.fromBrand("RecordAlias", RecordAlias)
).annotate({ title: "Record alias" })

const recordAliasesSchema = Schema.Array(recordAliasSchema)
  .check(Schema.isUnique())
  .annotate({ identifier: "RecordAliases", title: "Record aliases" })

const recordAliasDeltaSchema = Schema.Struct({
  add: Schema.optionalKey(
    Schema.Array(recordAliasSchema).check(Schema.isUnique())
  ),
  remove: Schema.optionalKey(
    Schema.Array(recordAliasSchema).check(Schema.isUnique())
  ),
}).check(
  Schema.makeFilter(
    ({ add = [], remove = [] }) => !add.some((alias) => remove.includes(alias)),
    { expected: "alias additions and removals that do not overlap" }
  )
)

const recordAliasUpdateSchema = Schema.Union([
  recordAliasesSchema,
  recordAliasDeltaSchema,
])

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
        .annotate({ format: "date" })
        .pipe(Schema.fromBrand("CalendarDate", CalendarDate))
    case "domain":
      return value
        .annotate({ format: "hostname" })
        .pipe(Schema.fromBrand("DomainName", DomainName))
    case "email":
      return value
        .annotate({ format: "email" })
        .pipe(Schema.fromBrand("EmailAddress", EmailAddress))
    case "phone":
      return value
        .annotate({ format: "tel" })
        .pipe(Schema.fromBrand("PhoneNumber", PhoneNumber))
    case "timestamp":
      return value
        .annotate({ format: "date-time" })
        .pipe(Schema.fromBrand("Timestamp", Timestamp))
    case "url":
      return value
        .annotate({ format: "uri" })
        .pipe(Schema.fromBrand("WebUrl", WebUrl))
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

function compileDecimal(definition: DecimalSchema): Schema.Codec<string> {
  let value = Schema.String.annotate({ format: "decimal" }).pipe(
    Schema.fromBrand("Decimal", Decimal)
  )
  if (definition.precision !== undefined || definition.scale !== undefined) {
    const precision = definition.precision
    const scale = definition.scale
    value = value.check(
      Schema.makeFilter(
        (decimal) => {
          const [integer = "", fraction = ""] = decimal
            .replace("-", "")
            .split(".")
          return (
            (precision === undefined ||
              integer.length + fraction.length <= precision) &&
            (scale === undefined || fraction.length <= scale)
          )
        },
        { expected: "a decimal within the declared precision and scale" }
      )
    )
  }
  return value
}

type CompileMode = "input" | "output"

function recordIdSchema(typeId: string) {
  return Schema.String.pipe(
    Schema.fromBrand(`RecordId:${typeId}`, RecordId(typeId))
  )
}

/** Schema for a canonical record ID or qualified alias at an input boundary. */
export function toEffectRecordIdentifierSchema(
  typeId: string
): Schema.Codec<RecordIdentifier, unknown> {
  return Schema.Union([recordIdSchema(typeId), recordAliasSchema]).annotate({
    description: "A canonical record ID or globally qualified record alias.",
    title: "Record identifier",
  })
}

function compileBase(
  definition: AnySchema,
  mode: CompileMode
): Schema.Codec<unknown, unknown> {
  switch (definition.kind) {
    case "array":
      return Schema.Array(compile(definition.items, mode))
    case "boolean":
      return Schema.Boolean
    case "decimal":
      return compileDecimal(definition)
    case "enum":
      return Schema.Literals(definition.values)
    case "file":
      return fileRefSchema
    case "geoPoint":
      return geoPointSchema
    case "image":
      return imageRefSchema
    case "literal":
      return definition.value === null
        ? Schema.Null
        : Schema.Literal(definition.value)
    case "map":
      return Schema.Record(Schema.String, compile(definition.values, mode))
    case "media":
      return mediaRefSchema
    case "money":
      return moneySchema
    case "number":
      return compileNumber(definition)
    case "optional":
      return Schema.optionalKey(compile(definition.value, mode))
    case "recordId":
      return mode === "input"
        ? toEffectRecordIdentifierSchema(definition.typeId)
        : recordIdSchema(definition.typeId)
    case "string":
      return compileString(definition)
    case "struct": {
      const fields: CompiledSchemaFields = Object.fromEntries(
        Object.entries(definition.properties).map(([id, member]) =>
          entry(id, compile(member, mode))
        )
      )
      return Schema.Struct(fields)
    }
    case "union":
      return Schema.Union(
        definition.members.map((member) => compile(member, mode))
      )
  }

  throw new Error("Unsupported schema kind.")
}

function compile(
  definition: AnySchema,
  mode: CompileMode
): Schema.Codec<unknown, unknown> {
  let value = compileBase(definition, mode)
  const metadata: SchemaDefinition = definition
  if (metadata.nullable === true) {
    value = Schema.NullOr(value)
  }
  if (definition.label !== undefined) {
    value = value.annotate({ title: definition.label })
  }
  if (definition.description !== undefined) {
    value = value.annotate({ description: definition.description })
  }
  if (definition.default !== undefined) {
    value = value.annotate({ default: definition.default })
  }
  if (definition.outputOnly === true) {
    value = value.annotate({ readOnly: true })
  }
  return value
}

export function toEffectSchema<TSchema extends AnySchema>(
  definition: TSchema
): Schema.Codec<InferSchema<TSchema>, unknown>
export function toEffectSchema(
  definition: AnySchema
): Schema.Codec<unknown, unknown> {
  return compile(definition, "output")
}

export function toEffectInputSchema(
  definition: AnySchema
): Schema.Codec<unknown, unknown> {
  return compile(definition, "input")
}

const compiledPropertySchemas = new WeakMap<
  PropertyDefinition,
  Map<string, Schema.Codec<unknown, unknown>>
>()

function compilePropertyValue(
  object: ObjectType,
  propertyId: string,
  property: PropertyDefinition,
  mode: CompileMode
): Schema.Codec<unknown, unknown> {
  const identifier = `${pascalCase(object.id)}${pascalCase(propertyId)}`
  const cacheKey = `${mode}:${identifier}`
  const cached = compiledPropertySchemas.get(property)?.get(cacheKey)
  if (cached !== undefined) return cached

  let value = compile(property, mode)
  if (
    property.nullable ||
    property.kind === "file" ||
    property.kind === "geoPoint" ||
    property.kind === "image" ||
    property.kind === "media" ||
    property.kind === "enum" ||
    (property.kind === "string" && property.format !== undefined)
  ) {
    value = value.annotate({ identifier })
  }
  const description = property.immutable
    ? [
        property.description,
        "Immutable after creation. Updates may repeat the current value but cannot change it.",
      ]
        .filter((part) => part !== undefined)
        .join(" ")
    : property.description
  if (description !== undefined) {
    value = value.annotate({ description })
  }
  const objectCache = compiledPropertySchemas.get(property) ?? new Map()
  objectCache.set(cacheKey, value)
  compiledPropertySchemas.set(property, objectCache)
  return value
}

function compileObjectProperties(object: ObjectType): CompiledSchemaFields {
  return Object.fromEntries(
    Object.entries(object.properties).map(([propertyId, property]) =>
      entry(
        propertyId,
        compilePropertyValue(object, propertyId, property, "output")
      )
    )
  )
}

function compileCreateProperties(object: ObjectType): CompiledSchemaFields {
  return Object.fromEntries(
    Object.entries(object.properties)
      .filter(([, property]) => !property.outputOnly)
      .map(([propertyId, property]) =>
        entry(
          propertyId,
          property.requiredOnCreate
            ? compilePropertyValue(object, propertyId, property, "input")
            : Schema.optionalKey(
                compilePropertyValue(object, propertyId, property, "input")
              )
        )
      )
  )
}

function compileUpdateProperties(object: ObjectType): CompiledSchemaFields {
  return Object.fromEntries(
    Object.entries(object.properties)
      .filter(([, property]) => !property.outputOnly)
      .map(([propertyId, property]) =>
        entry(
          propertyId,
          Schema.optionalKey(
            compilePropertyValue(object, propertyId, property, "input")
          )
        )
      )
  )
}

function annotateObjectSchema(
  object: ObjectType,
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

export function toEffectObjectSchema<TObject extends ObjectType>(
  object: TObject
): Schema.Codec<ObjectRecord<TObject>, unknown>
export function toEffectObjectSchema(
  object: ObjectType
): Schema.Codec<unknown, unknown> {
  const id = Schema.String.annotate({
    readOnly: true,
    title: `${object.name} ID`,
  }).pipe(Schema.fromBrand(`RecordId:${object.id}`, RecordId(object.id)))
  const createdAt = Schema.String.annotate({
    format: "date-time",
    readOnly: true,
    title: "Created at",
  }).pipe(Schema.fromBrand("Timestamp", Timestamp))
  const updatedAt = Schema.String.annotate({
    format: "date-time",
    readOnly: true,
    title: "Updated at",
  }).pipe(Schema.fromBrand("Timestamp", Timestamp))
  const actorId = Schema.String.annotate({ readOnly: true }).pipe(
    Schema.fromBrand("ActorId", ActorId)
  )
  const fields: CompiledSchemaFields = Object.fromEntries([
    entry("id", id),
    entry("aliases", recordAliasesSchema),
    entry("annotations", annotationsSchema),
    entry("createdAt", createdAt),
    entry("createdBy", actorId),
    entry(
      "etag",
      Schema.String.annotate({ readOnly: true }).pipe(
        Schema.fromBrand("Etag", Etag)
      )
    ),
    entry(
      "parent",
      Schema.String.annotate({ title: "Parent" }).pipe(
        Schema.fromBrand(
          `RecordId:${object.parent.typeId}`,
          RecordId(object.parent.typeId)
        )
      )
    ),
    entry(
      "systemManaged",
      Schema.Boolean.annotate({
        description:
          "Whether ordinary mutations are reserved for trusted system workflows.",
        readOnly: true,
        title: "System managed",
      })
    ),
    entry("updatedAt", updatedAt),
    entry("updatedBy", actorId),
    ...Object.entries(compileObjectProperties(object)),
  ])
  return annotateObjectSchema(
    object,
    Schema.Struct(fields),
    object.name,
    pascalCase(object.id)
  )
}

export function toEffectObjectCreateSchema(
  object: ObjectType
): Schema.Codec<unknown, unknown> {
  const fields: CompiledSchemaFields = {
    aliases: Schema.optionalKey(recordAliasesSchema),
    annotations: Schema.optionalKey(annotationsSchema),
    ...compileCreateProperties(object),
  }
  if (object.parent.kind !== "root") {
    fields.parent = toEffectRecordIdentifierSchema(
      object.parent.typeId
    ).annotate({ title: "Parent" })
  }
  return annotateObjectSchema(
    object,
    Schema.Struct(fields),
    `Create ${object.name}`,
    `${pascalCase(object.id)}CreateInput`
  )
}

export function toEffectObjectUpdateSchema(
  object: ObjectType
): Schema.Codec<unknown, unknown> {
  const fields: CompiledSchemaFields = {
    aliases: Schema.optionalKey(recordAliasUpdateSchema),
    annotations: Schema.optionalKey(annotationsSchema),
    ...compileUpdateProperties(object),
  }
  return annotateObjectSchema(
    object,
    Schema.Struct(fields),
    `Update ${object.name}`,
    `${pascalCase(object.id)}UpdateInput`
  )
}

export function toEffectErrorSchema<TError extends ErrorType>(
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
  error: ErrorType
): Schema.Codec<unknown, unknown> {
  let value = Schema.Struct({
    category: Schema.Literal(error.category),
    code: Schema.Literal(error.code),
    details: compile(error.details, "output"),
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
