import type { ErrorType } from "#/runtime/model/definition/error.ts"
import {
  definitionId,
  type NoExtraKeys,
} from "#/runtime/model/definition/identity.ts"
import type { ObjectType } from "#/runtime/model/definition/object.ts"
import {
  schema,
  type RecordIdSchema,
  type SchemaProperties,
  type StructSchema,
} from "#/runtime/model/definition/schema.ts"

type OperationAttachment =
  | { readonly object: ObjectType; readonly collection?: never }
  | { readonly collection: ObjectType; readonly object?: never }
  | { readonly object?: never; readonly collection?: never }

interface OperationFields {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly input?: SchemaProperties
  readonly output?: SchemaProperties
  readonly errors?: ReadonlyArray<ErrorType>
}
export type OperationDefinition = OperationFields & OperationAttachment
export type OperationConstraints<
  D extends OperationDefinition,
  Allowed = OperationDefinition,
> = NoExtraKeys<D, Allowed> &
  (D extends { readonly object: infer O extends ObjectType }
    ? { readonly input: { readonly id: RecordIdSchema<O["id"]> } }
    : unknown)

type Input<D> = D extends { readonly input: infer I extends SchemaProperties }
  ? I
  : {}
type Output<D> = D extends { readonly output: infer O extends SchemaProperties }
  ? O
  : {}
type OperationObjectId<D> = D extends {
  readonly object: infer O extends ObjectType
}
  ? O["id"]
  : D extends { readonly collection: infer O extends ObjectType }
    ? O["id"]
    : undefined
type OperationKey<D extends OperationDefinition> = D extends {
  readonly object: infer O extends ObjectType
}
  ? `${O["id"]}.${D["id"]}`
  : D extends { readonly collection: infer O extends ObjectType }
    ? `${O["id"]}.${D["id"]}`
    : D["id"]

/** Normalized, browser-safe custom contract. Authoring never injects parameters. */
export interface CustomOperation {
  readonly key: string
  readonly id: string
  readonly kind: "query" | "action"
  readonly name: string
  readonly description: string
  readonly objectType: string | undefined
  readonly scope: "object" | "collection" | "global"
  readonly input: StructSchema
  readonly output: StructSchema
  readonly errors: ReadonlyArray<ErrorType>
  readonly destructive: boolean
  readonly idempotent: boolean
}
export type DefinedOperation<D extends OperationDefinition> = Omit<
  CustomOperation,
  "key" | "id" | "input" | "output" | "errors" | "objectType" | "scope"
> & {
  readonly key: OperationKey<D>
  readonly id: D["id"]
  readonly objectType: OperationDefinition extends D
    ? string | undefined
    : OperationObjectId<D>
  readonly scope: OperationDefinition extends D
    ? CustomOperation["scope"]
    : D extends { readonly object: ObjectType }
      ? "object"
      : D extends { readonly collection: ObjectType }
        ? "collection"
        : "global"
  readonly input: StructSchema<
    OperationDefinition extends D ? SchemaProperties : Input<D>
  >
  readonly output: StructSchema<
    OperationDefinition extends D ? SchemaProperties : Output<D>
  >
  readonly errors: D extends {
    readonly errors: infer E extends ReadonlyArray<ErrorType>
  }
    ? E
    : ReadonlyArray<ErrorType>
}

export function defineOperationContract(
  definition: OperationDefinition
): Omit<CustomOperation, "kind" | "destructive" | "idempotent"> {
  const { object, collection } = definition
  if (object !== undefined && collection !== undefined)
    throw new Error("An operation cannot specify both object and collection.")
  const id = definitionId(definition.id)
  const target = object ?? collection
  const key = target ? `${target.id}.${id}` : id
  if (object) {
    const inputId = definition.input?.id
    if (
      inputId?.kind !== "recordId" ||
      inputId.typeId !== object.id ||
      inputId.nullable === true
    )
      throw new Error(
        `Operation '${key}' requires a non-nullable input.id declared with schema.id(${object.name}).`
      )
  }
  const reasons = new Set<string>()
  for (const error of definition.errors ?? []) {
    if (reasons.has(error.reason))
      throw new Error(
        `Operation '${key}' declares error '${error.reason}' more than once.`
      )
    reasons.add(error.reason)
  }
  return {
    key,
    id,
    name: definition.name,
    description: definition.description,
    objectType: target?.id,
    scope: object ? "object" : collection ? "collection" : "global",
    input: schema.object(definition.input ?? {}),
    output: schema.object(definition.output ?? {}),
    errors: definition.errors ?? [],
  }
}
