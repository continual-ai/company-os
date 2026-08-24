import type { ApiError, ErrorType } from "./error"
import { definitionId } from "./identity"
import type { Properties, PropertyDefinition } from "./property"
import { MAX_RECORD_ALIAS_LENGTH, schema } from "./schema"
import type {
  InferInputSchema,
  InferSchema,
  SchemaProperties,
  StructSchema,
} from "./schema"

const standardActionIds = ["create", "update", "delete", "batchDelete"] as const

export type StandardActionId = (typeof standardActionIds)[number]
export type ActionScope = "collection" | "object"

export function isStandardActionId(id: string): id is StandardActionId {
  return standardActionIds.some((standardId) => standardId === id)
}

export interface ActionHttpBinding {
  method: "DELETE" | "PATCH" | "POST"
  path: `/${string}`
}

interface CustomActionHttpBinding {
  path: `/${string}`
}

/**
 * Portable business action authored beside its primary object definition.
 * Object-scoped actions receive a typed record identifier when the action is bound.
 */
export interface ActionDefinition<
  TScope extends ActionScope = ActionScope,
  TInput extends SchemaProperties = SchemaProperties,
  TOutput extends SchemaProperties = SchemaProperties,
  TErrors extends ReadonlyArray<ErrorType> = ReadonlyArray<ErrorType>,
> {
  description: string
  destructive?: boolean
  errors?: TErrors
  http: CustomActionHttpBinding
  idempotent?: boolean
  input?: TInput
  name: string
  output?: TOutput
  scope: TScope
}

export type ActionDefinitions = Readonly<
  Record<string, false | ActionDefinition>
>

export interface StandardActionSettings {
  readonly batchDelete: boolean
  readonly create: boolean
  readonly delete: boolean
  readonly update: boolean
}

type NormalizedStandardActionSettings<TDefinitions extends ActionDefinitions> =
  {
    readonly batchDelete: TDefinitions["delete"] extends false
      ? false
      : TDefinitions["batchDelete"] extends false
        ? false
        : true
    readonly create: TDefinitions["create"] extends false ? false : true
    readonly delete: TDefinitions["delete"] extends false ? false : true
    readonly update: TDefinitions["update"] extends false ? false : true
  }

export interface Action<
  TId extends string = string,
  TObjectType extends string = string,
  TScope extends ActionScope = ActionScope,
  TInput extends StructSchema = StructSchema,
  TOutput extends StructSchema = StructSchema,
  TErrors extends ReadonlyArray<ErrorType> = ReadonlyArray<ErrorType>,
> {
  description: string
  destructive: boolean
  errors: TErrors
  http: ActionHttpBinding
  id: TId
  idempotent: boolean
  input: TInput
  kind: "action"
  name: string
  objectType: TObjectType
  output: TOutput
  scope: TScope
}

type InputProperties<
  TObjectType extends string,
  TDefinition extends ActionDefinition,
> = TDefinition["scope"] extends "object"
  ? {
      readonly id: ReturnType<
        typeof schema.recordId<{ readonly id: TObjectType }>
      >
    } & NonNullable<TDefinition["input"]>
  : NonNullable<TDefinition["input"]>

type BindAction<
  TId extends string,
  TObjectType extends string,
  TDefinition extends ActionDefinition,
> = Action<
  TId,
  TObjectType,
  TDefinition["scope"],
  StructSchema<InputProperties<TObjectType, TDefinition>>,
  StructSchema<
    TDefinition["output"] extends SchemaProperties ? TDefinition["output"] : {}
  >,
  TDefinition["errors"] extends ReadonlyArray<ErrorType>
    ? TDefinition["errors"]
    : readonly []
>

type BoundActions<
  TObjectType extends string,
  TDefinitions extends ActionDefinitions,
> = {
  readonly [
    TId in keyof TDefinitions as TId extends StandardActionId
      ? never
      : TDefinitions[TId] extends ActionDefinition
        ? TId
        : never
  ]: TDefinitions[TId] extends ActionDefinition
    ? BindAction<TId & string, TObjectType, TDefinitions[TId]>
    : never
}

type StandardActions<
  TObjectType extends string,
  TSettings extends StandardActionSettings,
> = (TSettings["batchDelete"] extends true
  ? { readonly batchDelete: Action<"batchDelete", TObjectType> }
  : object) &
  (TSettings["create"] extends true
    ? { readonly create: Action<"create", TObjectType> }
    : object) &
  (TSettings["delete"] extends true
    ? { readonly delete: Action<"delete", TObjectType> }
    : object) &
  (TSettings["update"] extends true
    ? { readonly update: Action<"update", TObjectType> }
    : object)

export type NormalizedActions<
  TObjectType extends string,
  TDefinitions extends ActionDefinitions,
> = BoundActions<TObjectType, TDefinitions> &
  StandardActions<TObjectType, NormalizedStandardActionSettings<TDefinitions>>

export interface BoundActionSet<
  TObjectType extends string,
  TDefinitions extends ActionDefinitions,
> {
  readonly actions: BoundActions<TObjectType, TDefinitions>
  readonly standard: NormalizedStandardActionSettings<TDefinitions>
}

export type ActionInput<TAction extends Action> = InferInputSchema<
  TAction["input"]
>
export type ActionOutput<TAction extends Action> = InferSchema<
  TAction["output"]
>
export type ActionError<TAction extends Action> = ApiError<
  TAction["errors"][number]
>

export function actionKey(action: Action): string {
  return `${action.objectType}.${action.id}`
}

function placeholderNames(path: string): ReadonlyArray<string> {
  return [...path.matchAll(/\{([^}/]+)\}/g)].map((match) => match[1] ?? "")
}

function validateHttpBinding(
  objectType: string,
  collection: string,
  actionId: string,
  definition: ActionDefinition,
  input: StructSchema
): void {
  const owner = `Action '${objectType}.${actionId}'`
  const prefix = `/${collection}`
  const path = definition.http.path
  if (
    path !== prefix &&
    !path.startsWith(`${prefix}/`) &&
    !path.startsWith(`${prefix}:`)
  ) {
    throw new Error(`${owner} HTTP path must begin with '${prefix}'.`)
  }

  const placeholders = placeholderNames(path)
  const idCount = placeholders.filter((name) => name === "id").length
  if (definition.scope === "object" && idCount !== 1) {
    throw new Error(`${owner} object path must contain '{id}' exactly once.`)
  }
  if (definition.scope === "collection" && idCount !== 0) {
    throw new Error(`${owner} collection path cannot contain '{id}'.`)
  }

  for (const placeholder of placeholders) {
    const property = input.properties[placeholder]
    if (property === undefined) {
      throw new Error(
        `${owner} HTTP path placeholder '{${placeholder}}' has no matching input property.`
      )
    }
    if (property.kind !== "recordId" && property.kind !== "string") {
      throw new Error(
        `${owner} HTTP path placeholder '{${placeholder}}' must bind a string or record ID input property.`
      )
    }
  }
}

function standardEnabled(
  definitions: ActionDefinitions | undefined,
  id: StandardActionId
): boolean {
  return definitions?.[id] !== false
}

export function bindActions<
  const TObjectType extends string,
  const TDefinitions extends ActionDefinitions,
>(
  object: { readonly collection: string; readonly id: TObjectType },
  definitions?: TDefinitions
): BoundActionSet<TObjectType, TDefinitions> {
  const actions: Record<string, Action> = {}

  for (const [id, definition] of Object.entries(definitions ?? {})) {
    if (isStandardActionId(id)) {
      if (definition !== false) {
        throw new Error(
          `Object '${object.id}' standard action '${id}' may only be disabled with false.`
        )
      }
      continue
    }
    if (definition === false) {
      throw new Error(
        `Object '${object.id}' custom action '${id}' cannot be false.`
      )
    }

    const actionId = definitionId(id)
    if (definition.scope === "object" && definition.input?.id !== undefined) {
      throw new Error(
        `Action '${object.id}.${actionId}' receives its 'id' from the object scope and cannot redeclare it.`
      )
    }
    const errors = definition.errors ?? []
    const errorCodes = errors.map((error) => error.code)
    const duplicateError = errorCodes.find(
      (code, index) => errorCodes.indexOf(code) !== index
    )
    if (duplicateError !== undefined) {
      throw new Error(
        `Action '${object.id}.${actionId}' declares error '${duplicateError}' more than once.`
      )
    }

    const inputProperties =
      definition.scope === "object"
        ? {
            id: schema.recordId(object),
            ...definition.input,
          }
        : definition.input === undefined
          ? {}
          : definition.input
    const input = schema.object(inputProperties)
    const output = schema.object(definition.output ?? {})
    validateHttpBinding(
      object.id,
      object.collection,
      actionId,
      definition,
      input
    )

    actions[actionId] = {
      kind: "action",
      id: actionId,
      objectType: object.id,
      name: definition.name,
      description: definition.description,
      destructive: definition.destructive === true,
      idempotent: definition.idempotent === true,
      scope: definition.scope,
      errors,
      http: { method: "POST", path: definition.http.path },
      input,
      output,
    }
  }

  return {
    // SAFETY: every authored definition is normalized under its validated key.
    // oxlint-disable-next-line anti-slop/no-known-value-widening, typescript/no-unsafe-type-assertion
    actions: actions as BoundActions<TObjectType, TDefinitions>,
    // SAFETY: standardEnabled implements the same false-only conditional encoded by this type.
    // oxlint-disable-next-line anti-slop/no-known-value-widening, typescript/no-unsafe-type-assertion
    standard: {
      batchDelete:
        standardEnabled(definitions, "delete") &&
        standardEnabled(definitions, "batchDelete"),
      create: standardEnabled(definitions, "create"),
      delete: standardEnabled(definitions, "delete"),
      update: standardEnabled(definitions, "update"),
    } as NormalizedStandardActionSettings<TDefinitions>,
  }
}

function writablePropertySchema(property: PropertyDefinition) {
  return property.requiredOnCreate ? property : schema.optional(property)
}

function aliasesSchema() {
  return schema.array(
    schema.string({ minLength: 1, maxLength: MAX_RECORD_ALIAS_LENGTH })
  )
}

function aliasUpdateSchema() {
  return schema.union([
    aliasesSchema(),
    schema.object({
      add: schema.optional(aliasesSchema()),
      remove: schema.optional(aliasesSchema()),
    }),
  ])
}

function objectRecordSchema(object: {
  readonly id: string
  readonly parent: { readonly typeId: string }
  readonly properties: Properties
}) {
  return schema.object({
    id: schema.recordId(object),
    aliases: aliasesSchema(),
    metadata: schema.map(schema.string()),
    createdAt: schema.timestamp({ outputOnly: true }),
    createdBy: schema.string({ outputOnly: true }),
    etag: schema.string({ outputOnly: true }),
    parent: schema.recordId({ id: object.parent.typeId }),
    systemManaged: schema.boolean({ outputOnly: true }),
    updatedAt: schema.timestamp({ outputOnly: true }),
    updatedBy: schema.string({ outputOnly: true }),
    ...object.properties,
  })
}

export function standardActions(
  object: {
    readonly collection: string
    readonly id: string
    readonly name: string
    readonly parent: {
      readonly kind: "interface" | "object" | "root"
      readonly typeId: string
    }
    readonly pluralName: string
    readonly properties: Properties
  },
  settings: StandardActionSettings
): ReadonlyArray<Action> {
  const actions: Array<Action> = []
  const record = objectRecordSchema(object)
  const writableProperties = Object.fromEntries(
    Object.entries(object.properties)
      .filter(([, property]) => !property.outputOnly)
      .map(([id, property]) => [id, writablePropertySchema(property)])
  )
  const updateProperties = Object.fromEntries(
    Object.entries(object.properties)
      .filter(([, property]) => !property.outputOnly)
      .map(([id, property]) => [id, schema.optional(property)])
  )
  if (settings.create) {
    const parentInput =
      object.parent.kind === "root"
        ? {}
        : { parent: schema.recordId({ id: object.parent.typeId }) }
    actions.push({
      kind: "action",
      id: "create",
      objectType: object.id,
      scope: "collection",
      name: `Create ${object.name.toLowerCase()}`,
      description: `Creates a ${object.name.toLowerCase()}.`,
      destructive: false,
      idempotent: false,
      http: { method: "POST", path: `/${object.collection}` },
      input: schema.object({
        aliases: schema.optional(aliasesSchema()),
        metadata: schema.optional(schema.map(schema.string())),
        ...parentInput,
        ...writableProperties,
      }),
      output: record,
      errors: [],
    })
  }
  if (settings.update) {
    actions.push({
      kind: "action",
      id: "update",
      objectType: object.id,
      scope: "object",
      name: `Update ${object.name.toLowerCase()}`,
      description: `Updates a ${object.name.toLowerCase()}.`,
      destructive: false,
      idempotent: true,
      http: { method: "PATCH", path: `/${object.collection}/{id}` },
      input: schema.object({
        id: schema.recordId(object),
        aliases: schema.optional(aliasUpdateSchema()),
        etag: schema.optional(schema.string()),
        metadata: schema.optional(schema.map(schema.string())),
        ...updateProperties,
      }),
      output: record,
      errors: [],
    })
  }
  if (settings.delete) {
    actions.push({
      kind: "action",
      id: "delete",
      objectType: object.id,
      scope: "object",
      name: `Delete ${object.name.toLowerCase()}`,
      description: `Deletes a ${object.name.toLowerCase()}.`,
      destructive: true,
      idempotent: true,
      http: { method: "DELETE", path: `/${object.collection}/{id}` },
      input: schema.object({
        id: schema.recordId(object),
        etag: schema.optional(schema.string()),
      }),
      output: schema.object({}),
      errors: [],
    })
  }
  if (settings.batchDelete) {
    actions.push({
      kind: "action",
      id: "batchDelete",
      objectType: object.id,
      scope: "collection",
      name: `Batch delete ${object.pluralName.toLowerCase()}`,
      description: `Deletes multiple ${object.pluralName.toLowerCase()} atomically.`,
      destructive: true,
      idempotent: true,
      http: { method: "POST", path: `/${object.collection}:batchDelete` },
      input: schema.object({ ids: schema.array(schema.recordId(object)) }),
      output: schema.object({}),
      errors: [],
    })
  }
  return actions
}
