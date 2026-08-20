import type { ApiError, ErrorType } from "./error"
import { definitionId } from "./identity"
import type { Properties, PropertyDefinition } from "./property"
import { Root } from "./root"
import { schema } from "./schema"
import type { InferSchema, SchemaProperties, StructSchema } from "./schema"

const defaultActionIds = ["create", "update", "delete"] as const

type DefaultActionId = (typeof defaultActionIds)[number]
export type ActionScope = "collection" | "object"

export interface ActionHttpBinding {
  method: "DELETE" | "PATCH" | "POST"
  path: `/${string}`
}

interface CustomActionHttpBinding {
  path: `/${string}`
}

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

export interface ActionSettings {
  readonly create: boolean
  readonly delete: boolean
  readonly update: boolean
}

export type NormalizedActionSettings<TDefinitions extends ActionDefinitions> = {
  readonly create: TDefinitions["create"] extends false ? false : true
  readonly delete: TDefinitions["delete"] extends false ? false : true
  readonly update: TDefinitions["update"] extends false ? false : true
}

export interface Action<
  TId extends string = string,
  TObjectId extends string = string,
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
  objectId: TObjectId
  output: TOutput
  scope: TScope
}

type InputProperties<
  TObjectId extends string,
  TDefinition extends ActionDefinition,
> = TDefinition["scope"] extends "object"
  ? {
      readonly id: ReturnType<
        typeof schema.recordId<{ readonly id: TObjectId }>
      >
    } & NonNullable<TDefinition["input"]>
  : NonNullable<TDefinition["input"]>

type BindAction<
  TId extends string,
  TObjectId extends string,
  TDefinition extends ActionDefinition,
> = Action<
  TId,
  TObjectId,
  TDefinition["scope"],
  StructSchema<InputProperties<TObjectId, TDefinition>>,
  StructSchema<
    TDefinition["output"] extends SchemaProperties ? TDefinition["output"] : {}
  >,
  TDefinition["errors"] extends ReadonlyArray<ErrorType>
    ? TDefinition["errors"]
    : readonly []
>

export type BoundActions<
  TObjectId extends string,
  TDefinitions extends ActionDefinitions,
> = {
  readonly [
    TId in keyof TDefinitions as TId extends DefaultActionId
      ? never
      : TDefinitions[TId] extends ActionDefinition
        ? TId
        : never
  ]: TDefinitions[TId] extends ActionDefinition
    ? BindAction<TId & string, TObjectId, TDefinitions[TId]>
    : never
}

export interface BoundActionSet<
  TObjectId extends string,
  TDefinitions extends ActionDefinitions,
> {
  readonly actions: BoundActions<TObjectId, TDefinitions>
  readonly defaults: NormalizedActionSettings<TDefinitions>
}

export type ActionInput<TAction extends Action> = InferSchema<TAction["input"]>
export type ActionOutput<TAction extends Action> = InferSchema<
  TAction["output"]
>
export type ActionError<TAction extends Action> = ApiError<
  TAction["errors"][number]
>

export function actionKey(action: Action): string {
  return `${action.objectId}.${action.id}`
}

function placeholderNames(path: string): ReadonlyArray<string> {
  return [...path.matchAll(/\{([^}/]+)\}/g)].map((match) => match[1] ?? "")
}

function validateHttpBinding(
  objectId: string,
  collection: string,
  actionId: string,
  definition: ActionDefinition,
  input: StructSchema
): void {
  const owner = `Action '${objectId}.${actionId}'`
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

function defaultEnabled(
  definitions: ActionDefinitions | undefined,
  id: DefaultActionId
): boolean {
  return definitions?.[id] !== false
}

export function bindActions<
  const TObjectId extends string,
  const TDefinitions extends ActionDefinitions,
>(
  object: { readonly collection: string; readonly id: TObjectId },
  definitions?: TDefinitions
): BoundActionSet<TObjectId, TDefinitions> {
  const actions: Record<string, Action> = {}

  for (const [id, definition] of Object.entries(definitions ?? {})) {
    if (defaultActionIds.some((defaultId) => defaultId === id)) {
      if (definition !== false) {
        throw new Error(
          `Object '${object.id}' default action '${id}' may only be disabled with false.`
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
      objectId: object.id,
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
    // SAFETY: every non-default definition is normalized under its validated key.
    // oxlint-disable-next-line anti-slop/no-known-value-widening, typescript/no-unsafe-type-assertion
    actions: actions as BoundActions<TObjectId, TDefinitions>,
    // SAFETY: defaultEnabled implements the same false-only conditional encoded by this type.
    // oxlint-disable-next-line anti-slop/no-known-value-widening, typescript/no-unsafe-type-assertion
    defaults: {
      create: defaultEnabled(definitions, "create"),
      delete: defaultEnabled(definitions, "delete"),
      update: defaultEnabled(definitions, "update"),
    } as NormalizedActionSettings<TDefinitions>,
  }
}

function writablePropertySchema(property: PropertyDefinition) {
  return property.required ? property : schema.optional(property)
}

function objectRecordSchema(object: {
  readonly id: string
  readonly parent: { readonly objectId: string }
  readonly properties: Properties
}) {
  return schema.object({
    id: schema.recordId(object),
    annotations: schema.map(schema.string()),
    createdAt: schema.timestamp({ outputOnly: true }),
    createdById: schema.string({ outputOnly: true }),
    etag: schema.string({ outputOnly: true }),
    parentId: schema.recordId({ id: object.parent.objectId }),
    updatedAt: schema.timestamp({ outputOnly: true }),
    updatedById: schema.string({ outputOnly: true }),
    ...object.properties,
  })
}

export function standardActions(object: {
  readonly collection: string
  readonly defaultActions: ActionSettings
  readonly id: string
  readonly name: string
  readonly parent: { readonly objectId: string }
  readonly properties: Properties
}): ReadonlyArray<Action> {
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
  if (object.defaultActions.create) {
    const parentInput =
      object.parent.objectId === Root.id
        ? {}
        : { parentId: schema.recordId({ id: object.parent.objectId }) }
    actions.push({
      kind: "action",
      id: "create",
      objectId: object.id,
      scope: "collection",
      name: `Create ${object.name.toLowerCase()}`,
      description: `Creates a ${object.name.toLowerCase()}.`,
      destructive: false,
      idempotent: false,
      http: { method: "POST", path: `/${object.collection}` },
      input: schema.object({
        annotations: schema.optional(schema.map(schema.string())),
        ...parentInput,
        ...writableProperties,
      }),
      output: record,
      errors: [],
    })
  }
  if (object.defaultActions.update) {
    actions.push({
      kind: "action",
      id: "update",
      objectId: object.id,
      scope: "object",
      name: `Update ${object.name.toLowerCase()}`,
      description: `Updates a ${object.name.toLowerCase()}.`,
      destructive: false,
      idempotent: true,
      http: { method: "PATCH", path: `/${object.collection}/{id}` },
      input: schema.object({
        id: schema.recordId(object),
        annotations: schema.optional(schema.map(schema.string())),
        ...updateProperties,
      }),
      output: record,
      errors: [],
    })
  }
  if (object.defaultActions.delete) {
    actions.push({
      kind: "action",
      id: "delete",
      objectId: object.id,
      scope: "object",
      name: `Delete ${object.name.toLowerCase()}`,
      description: `Deletes a ${object.name.toLowerCase()}.`,
      destructive: true,
      idempotent: true,
      http: { method: "DELETE", path: `/${object.collection}/{id}` },
      input: schema.object({ id: schema.recordId(object) }),
      output: schema.object({}),
      errors: [],
    })
  }
  return actions
}
