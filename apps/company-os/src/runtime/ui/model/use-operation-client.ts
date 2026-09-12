import type { UseMutationOptions } from "@tanstack/react-query"

import type { ModelClientError } from "#/runtime/client/http-client.ts"
import type { ModelQueryOptions } from "#/runtime/client/model-query-client.ts"
import type {
  Action,
  Query,
  InferInputSchema,
  InferSchema,
} from "#/runtime/model/index.ts"
import {
  useModelRuntime,
  type ModelUiRuntime,
} from "#/runtime/ui/model/runtime-context.tsx"

type Operation = Action | Query
export type OperationQueryClient<O extends Operation> = Action extends O
  ? () => UseMutationOptions<
      unknown,
      ModelClientError,
      Readonly<Record<string, unknown>>
    >
  : Query extends O
    ? (input: Readonly<Record<string, unknown>>) => ModelQueryOptions<unknown>
    : O["kind"] extends "query"
      ? (
          input: InferInputSchema<O["input"]>
        ) => ModelQueryOptions<InferSchema<O["output"]>>
      : () => UseMutationOptions<
          InferSchema<O["output"]>,
          ModelClientError,
          InferInputSchema<O["input"]>
        >

/** Select a contributed or global operation by its definition, independent of the owning app. */
function operationQueryClient<O extends Operation>(
  runtime: ModelUiRuntime,
  operation: O
): OperationQueryClient<O> {
  const installed =
    operation.kind === "action"
      ? runtime.model.actions[operation.key]
      : runtime.model.queries[operation.key]
  if (installed !== operation)
    throw new Error(`Operation '${operation.key}' is not installed.`)
  const group =
    operation.objectType === undefined
      ? runtime.data
      : Reflect.get(runtime.data, operation.objectType)
  // SAFETY: the exact installed definition generated this client's typed options.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return Reflect.get(group, operation.id) as OperationQueryClient<O>
}
export function useOperationClient<O extends Operation>(operation: O) {
  return operationQueryClient(useModelRuntime(), operation)
}
