// Model authors retain precise service types; transport projections need one
// checked dynamic dispatch seam because model operation IDs are runtime data.
import type { Effect, Schema } from "effect"
import type { SqlError } from "effect/unstable/sql/SqlError"

import { type Action } from "#/runtime/model/definition/action.ts"
import type { ModelExpansion } from "#/runtime/model/definition/model-record.ts"
import { type ModelCatalog } from "#/runtime/model/definition/model.ts"
import type {
  ObjectCreateInput,
  ObjectUpdateInput,
  ObjectRecord,
  ObjectType,
  ObjectGetInput,
  ObjectBatchGetInput,
} from "#/runtime/model/definition/object.ts"
import { type Query } from "#/runtime/model/definition/query.ts"
import type {
  ListRequest,
  Page,
  Batch,
} from "#/runtime/model/definition/request.ts"
import {
  type InferInputSchema,
  type InferSchema,
} from "#/runtime/model/definition/schema.ts"
import {
  type ProjectAccessRequired,
  type SystemRecordReadOnly,
} from "#/runtime/server/errors.ts"
import type { CurrentInvocation } from "#/runtime/server/invocation.ts"
import type { Repository } from "#/runtime/server/repository.ts"

export type CustomOperationService<
  Operations extends Action | Query,
  R = CurrentInvocation,
> = {
  readonly [O in Operations as O["id"]]: (
    input: InferInputSchema<O["input"]>
  ) => Effect.Effect<InferSchema<O["output"]>, unknown, R>
}

type CustomOperations<M extends ModelCatalog> = Extract<
  M["actions"][keyof M["actions"]] | M["queries"][keyof M["queries"]],
  Action | Query
>
type OperationResult<
  A,
  O extends ObjectType,
  K extends keyof Repository<O>,
> = Effect.Effect<
  A,
  | Effect.Error<ReturnType<Repository<O>[K]>>
  | Schema.SchemaError
  | SqlError
  | ProjectAccessRequired
  | SystemRecordReadOnly,
  CurrentInvocation
>

type Writes<M extends ModelCatalog, O extends ObjectType> = {
  readonly [
    K in keyof O["actions"] & ("create" | "update" | "delete" | "batchDelete")
  ]: (
    input: K extends "create"
      ? ObjectCreateInput<O, M>
      : K extends "update"
        ? ObjectUpdateInput<O, M>
        : Parameters<Repository<O>[K]>[0]
  ) => OperationResult<
    K extends "create" | "update" ? ObjectRecord<O, M> : void,
    O,
    K
  >
}
type TypedObjectService<M extends ModelCatalog, O extends ObjectType> = Writes<
  M,
  O
> & {
  get: <const E extends ModelExpansion<M, O> = false>(
    input: ObjectGetInput<O> & { readonly expand?: E }
  ) => OperationResult<ObjectRecord<O, M, E>, O, "get">
  list: <const E extends ModelExpansion<M, O> = false>(
    input?: Omit<ListRequest<O>, "expand"> & { readonly expand?: E }
  ) => OperationResult<Page<ObjectRecord<O, M, E>>, O, "list">
  batchGet: <const E extends ModelExpansion<M, O> = false>(
    input: ObjectBatchGetInput<O> & { readonly expand?: E }
  ) => OperationResult<Batch<ObjectRecord<O, M, E>>, O, "batchGet">
}
export type OperationServices<M extends ModelCatalog> = {
  readonly [
    O in M["objects"][keyof M["objects"]] as O["id"]
  ]: TypedObjectService<M, O> &
    CustomOperationService<
      Extract<CustomOperations<M>, { readonly objectType: O["id"] }>
    >
} & CustomOperationService<
  Extract<CustomOperations<M>, { readonly objectType: undefined }>
>
