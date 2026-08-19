import type {
  FieldDefinition,
  Fields,
  InferField,
  InferFields,
  OutputFieldKeys,
} from "./field"
import { definitionId } from "./identity"
import type { EnumSchema, ImageSchema, RecordId, Timestamp } from "./schema"

export const objectOperationNames = [
  "batchGet",
  "create",
  "get",
  "list",
  "update",
  "delete",
] as const

export type ObjectOperation = (typeof objectOperationNames)[number]
export type ObjectOperations = Readonly<Record<ObjectOperation, boolean>>
export type ObjectOperationOptions = Partial<ObjectOperations>

interface NormalizedObjectOperations<
  TOperations extends ObjectOperationOptions,
> {
  readonly batchGet: TOperations["batchGet"] extends false ? false : true
  readonly create: TOperations["create"] extends false ? false : true
  readonly delete: TOperations["delete"] extends false ? false : true
  readonly get: TOperations["get"] extends false ? false : true
  readonly list: TOperations["list"] extends false ? false : true
  readonly update: TOperations["update"] extends false ? false : true
}

export interface BaseRecord<TObjectId extends string = string> {
  readonly annotations: Readonly<Record<string, string>>
  readonly createdAt: Timestamp
  readonly createdById: ActorId
  readonly etag: Etag
  readonly id: RecordId<TObjectId>
  readonly updatedAt: Timestamp
  readonly updatedById: ActorId
}

export type ActorId = string & { readonly _ActorId: true }
export type Etag = string & { readonly _Etag: true }

export interface ObjectDisplay<TFields extends Fields> {
  image?: {
    [
      TKey in OutputFieldKeys<TFields>
    ]: TFields[TKey] extends FieldDefinition<ImageSchema> ? TKey : never
  }[OutputFieldKeys<TFields>] &
    string
  status?: {
    [
      TKey in OutputFieldKeys<TFields>
    ]: TFields[TKey] extends FieldDefinition<EnumSchema> ? TKey : never
  }[OutputFieldKeys<TFields>] &
    string
  subtitle?: OutputFieldKeys<TFields> & string
  title: OutputFieldKeys<TFields> & string
}

export interface DefinedObject<
  TId extends string = string,
  TCollection extends string = string,
  TFields extends Fields = Fields,
  TOperations extends ObjectOperations = ObjectOperations,
> {
  collection: TCollection
  description?: string
  display: {
    image?: string
    status?: string
    subtitle?: string
    title: string
  }
  fields: TFields
  id: TId
  kind: "object"
  name: string
  operations: TOperations
  pluralName: string
}

export type ObjectRecord<TObject extends DefinedObject> = BaseRecord<
  TObject["id"]
> &
  InferFields<TObject["fields"]>

type FieldRequired<TField extends FieldDefinition> = TField["required"]

type FieldValue<TField extends FieldDefinition> =
  TField["nullable"] extends true
    ? InferField<TField> | null
    : InferField<TField>

type CreateFieldKeys<TFields extends Fields> = {
  [TKey in keyof TFields]: TFields[TKey]["outputOnly"] extends true
    ? never
    : TKey
}[keyof TFields]

type RequiredCreateFieldKeys<TFields extends Fields> = {
  [TKey in CreateFieldKeys<TFields>]: FieldRequired<TFields[TKey]> extends true
    ? TKey
    : never
}[CreateFieldKeys<TFields>]

type OptionalCreateFieldKeys<TFields extends Fields> = Exclude<
  CreateFieldKeys<TFields>,
  RequiredCreateFieldKeys<TFields>
>

type UpdateFieldKeys<TFields extends Fields> = {
  [TKey in keyof TFields]: TFields[TKey]["outputOnly"] extends true
    ? never
    : TKey
}[keyof TFields]

type Simplify<TValue> = { [TKey in keyof TValue]: TValue[TKey] } & {}

interface BaseWriteFields {
  readonly annotations?: Readonly<Record<string, string>>
}

export type ObjectCreateInput<TObject extends DefinedObject> = Simplify<
  BaseWriteFields & {
    readonly [TKey in RequiredCreateFieldKeys<TObject["fields"]>]: FieldValue<
      TObject["fields"][TKey]
    >
  } & {
    readonly [TKey in OptionalCreateFieldKeys<TObject["fields"]>]?: FieldValue<
      TObject["fields"][TKey]
    >
  }
>

export type ObjectUpdateInput<TObject extends DefinedObject> = Simplify<
  BaseWriteFields & {
    readonly [TKey in UpdateFieldKeys<TObject["fields"]>]?: FieldValue<
      TObject["fields"][TKey]
    >
  }
>

const reservedFieldIds = new Set([
  "annotations",
  "createdAt",
  "createdById",
  "etag",
  "id",
  "updatedAt",
  "updatedById",
])

function operationEnabled<
  const TOperations extends ObjectOperationOptions,
  const TOperation extends ObjectOperation,
>(
  operations: TOperations | undefined,
  operation: TOperation
): NormalizedObjectOperations<TOperations>[TOperation]
function operationEnabled(
  operations: ObjectOperationOptions | undefined,
  operation: ObjectOperation
): boolean {
  return operations?.[operation] !== false
}

function normalizeOperations<const TOperations extends ObjectOperationOptions>(
  operations: TOperations | undefined
): NormalizedObjectOperations<TOperations> {
  return {
    batchGet: operationEnabled(operations, "batchGet"),
    create: operationEnabled(operations, "create"),
    get: operationEnabled(operations, "get"),
    list: operationEnabled(operations, "list"),
    update: operationEnabled(operations, "update"),
    delete: operationEnabled(operations, "delete"),
  }
}

export function defineObject<
  const TId extends string,
  const TCollection extends string,
  const TFields extends Fields,
  const TOperations extends ObjectOperationOptions = {},
>(definition: {
  collection: TCollection
  description?: string
  display: ObjectDisplay<TFields>
  fields: TFields
  id: TId
  name: string
  operations?: TOperations
  pluralName: string
}): DefinedObject<
  TId,
  TCollection,
  TFields,
  NormalizedObjectOperations<TOperations>
> {
  for (const fieldId of Object.keys(definition.fields)) {
    definitionId(fieldId)
    if (reservedFieldIds.has(fieldId)) {
      throw new Error(
        `Object '${definition.id}' cannot redefine base record field '${fieldId}'.`
      )
    }
  }

  for (const [role, fieldId] of Object.entries(definition.display)) {
    const displayField = definition.fields[fieldId]
    if (displayField === undefined) {
      throw new Error(
        `Object '${definition.id}' display ${role} references unknown field '${fieldId}'.`
      )
    }
    if (role === "image" && displayField.kind !== "image") {
      throw new Error(
        `Object '${definition.id}' display image must reference an image field.`
      )
    }
    if (role === "status" && displayField.kind !== "select") {
      throw new Error(
        `Object '${definition.id}' display status must reference a select field.`
      )
    }
  }

  return {
    kind: "object",
    ...definition,
    collection: definitionId(definition.collection),
    id: definitionId(definition.id),
    operations: normalizeOperations(definition.operations),
  }
}
