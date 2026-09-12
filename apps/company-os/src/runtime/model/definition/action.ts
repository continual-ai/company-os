import type { ApiError } from "#/runtime/model/definition/error.ts"
import {
  defineOperationContract,
  type DefinedOperation,
  type OperationConstraints,
  type OperationDefinition,
} from "#/runtime/model/definition/operation.ts"
import type {
  InferInputSchema,
  InferSchema,
} from "#/runtime/model/definition/schema.ts"

const standardActionIds = ["create", "update", "delete", "batchDelete"] as const
export type StandardActionId = (typeof standardActionIds)[number]
export type StandardActionOptions = Partial<
  Readonly<Record<StandardActionId, false>>
>
export type ActionDefinition = OperationDefinition & {
  readonly destructive?: boolean
  readonly idempotent?: boolean
}
export type Action<D extends ActionDefinition = ActionDefinition> = Omit<
  DefinedOperation<D>,
  "kind"
> & { readonly kind: "action" }
export type ActionInput<A extends Action> = InferInputSchema<A["input"]>
export type ActionOutput<A extends Action> = InferSchema<A["output"]>
export type ActionError<A extends Action> = ApiError<A["errors"][number]>

export function defineAction<const D extends ActionDefinition>(
  definition: D & OperationConstraints<D, ActionDefinition>
): Action<D> {
  // SAFETY: the constructor preserves each literal field and validates record attachment.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return {
    ...defineOperationContract(definition),
    kind: "action",
    destructive: definition.destructive === true,
    idempotent: definition.idempotent === true,
  } as Action<D>
}

export interface StandardAction<
  TId extends StandardActionId = StandardActionId,
  TObjectType extends string = string,
> {
  readonly id: TId
  readonly kind: "action"
  readonly objectType: TObjectType
  readonly scope: "object" | "collection"
  readonly name: string
  readonly description: string
  readonly destructive: boolean
  readonly idempotent: boolean
}
export type ModelAction = Action | StandardAction
export type StandardActionSettings = Readonly<Record<StandardActionId, boolean>>
export type NormalizedActions<
  O extends string,
  D extends StandardActionOptions,
> = {
  readonly [
    K in StandardActionId as D[K] extends false
      ? never
      : K extends "batchDelete"
        ? D["delete"] extends false
          ? never
          : K
        : K
  ]: StandardAction<K, O>
}
export function isStandardActionId(id: string): id is StandardActionId {
  return standardActionIds.some((candidate) => candidate === id)
}
export function standardActionSettings(
  definitions: StandardActionOptions = {}
): StandardActionSettings {
  for (const [id, value] of Object.entries<unknown>(definitions)) {
    if (!isStandardActionId(id) || value !== false)
      throw new Error(
        `Object action '${id}' must be a standard operation disabled with false. Define custom actions in a module.`
      )
  }
  return {
    create: definitions.create !== false,
    update: definitions.update !== false,
    delete: definitions.delete !== false,
    batchDelete:
      definitions.delete !== false && definitions.batchDelete !== false,
  }
}

/** Standard operation metadata; contract resolution supplies the complete model-aware schemas. */
export function standardActions(
  object: {
    readonly id: string
    readonly name: string
    readonly pluralName: string
  },
  settings: StandardActionSettings
): ReadonlyArray<StandardAction> {
  const definitions: ReadonlyArray<StandardAction> = [
    {
      id: "create",
      kind: "action",
      objectType: object.id,
      scope: "collection",
      name: `Create ${object.name.toLowerCase()}`,
      description: `Creates a ${object.name.toLowerCase()}.`,
      destructive: false,
      idempotent: false,
    },
    {
      id: "update",
      kind: "action",
      objectType: object.id,
      scope: "object",
      name: `Update ${object.name.toLowerCase()}`,
      description: `Updates a ${object.name.toLowerCase()}.`,
      destructive: false,
      idempotent: true,
    },
    {
      id: "delete",
      kind: "action",
      objectType: object.id,
      scope: "object",
      name: `Delete ${object.name.toLowerCase()}`,
      description: `Deletes a ${object.name.toLowerCase()}.`,
      destructive: true,
      idempotent: true,
    },
    {
      id: "batchDelete",
      kind: "action",
      objectType: object.id,
      scope: "collection",
      name: `Batch delete ${object.pluralName.toLowerCase()}`,
      description: `Deletes multiple ${object.pluralName.toLowerCase()} atomically.`,
      destructive: true,
      idempotent: true,
    },
  ]
  return definitions.filter(({ id }) => settings[id])
}
