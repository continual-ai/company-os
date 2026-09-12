import {
  MutationObserver,
  queryOptions,
  type QueryClient,
  type DataTag,
  type UseMutationOptions,
} from "@tanstack/react-query"
import { Effect } from "effect"

import {
  ClientChanges,
  type EffectClient,
  runClientEffect,
} from "#/runtime/client/create-client.ts"
import { cacheGeneration } from "#/runtime/client/data-client.ts"
import type {
  ModelClient,
  CustomOperations,
  ModelObjectClient,
} from "#/runtime/client/http-client.ts"
import { applyMutationResult } from "#/runtime/client/model-cache.ts"
import type { RecordBatchInput } from "#/runtime/contract/record-batch.ts"
import type { RecordSearchInput } from "#/runtime/contract/record-search.ts"
import {
  modelObjectLinkTraversals,
  modelObjects,
  modelObjectQueries,
  modelObjectActions,
  modelTypeAccepts,
  type ModelCatalog,
  type ModelObject,
  type ObjectType,
} from "#/runtime/model/index.ts"

export function modelQuery<A, E>(
  objectTypes: ReadonlyArray<string>,
  operation: string,
  input: unknown,
  request: (signal: AbortSignal) => Promise<A>,
  custom = false
): ModelQueryOptions<A, E> {
  const options = queryOptions<A, E>({
    queryKey: ["model", objectTypes[0], operation, input],
    queryFn: ({ signal }) => request(signal),
    meta: { objectTypes, custom, operation },
  })
  return {
    queryKey: options.queryKey,
    queryFn: ({ signal }: { signal: AbortSignal }) => request(signal),
    meta: { objectTypes, custom, operation },
  }
}

export interface ModelQueryOptions<A, E = unknown> {
  readonly queryKey: DataTag<readonly unknown[], A, E>
  readonly queryFn: (context: { signal: AbortSignal }) => Promise<A>
  readonly meta: {
    objectTypes: ReadonlyArray<string>
    custom: boolean
    operation: string
  }
}
type QueryMethod<T> = T extends (
  ...args: infer Args
) => Effect.Effect<infer A, infer E>
  ? (...args: Args) => ModelQueryOptions<A, E>
  : never
type MutationMethod<T> = T extends (
  input: infer Input
) => Effect.Effect<infer A, infer E>
  ? () => UseMutationOptions<A, E, Input>
  : never
type ObjectQueries<QueryIds extends PropertyKey, C> = {
  readonly [K in keyof C]: C[K] extends (...args: never[]) => unknown
    ? K extends "get" | "list" | "batchGet" | QueryIds
      ? QueryMethod<C[K]>
      : MutationMethod<C[K]>
    : {
        readonly [L in keyof C[K]]: L extends "list"
          ? QueryMethod<C[K][L]>
          : MutationMethod<C[K][L]>
      }
}
type ModelQueries<M extends ModelCatalog> = {
  readonly [O in ModelObject<M> as O["id"]]: ObjectQueries<
    Extract<
      CustomOperations<M>,
      { readonly objectType: O["id"]; readonly kind: "query" }
    >["id"],
    ModelClient<M>[O["id"]]
  >
} & {
  readonly [
    O in Extract<
      CustomOperations<M>,
      { readonly objectType: undefined }
    > as O["id"]
  ]: O["kind"] extends "query"
    ? QueryMethod<ModelClient<M>[O["id"]]>
    : MutationMethod<ModelClient<M>[O["id"]]>
} & {
  readonly records: {
    readonly batchGet: QueryMethod<EffectClient<M>["records"]["batchGet"]>
    readonly search: QueryMethod<EffectClient<M>["records"]["search"]>
  }
}

const method = (group: object, name: string) => {
  const fn = Reflect.get(group, name)
  if (typeof fn !== "function")
    throw new Error(`Missing model operation ${name}`)
  // SAFETY: the implementation and projection are built from the same closed model.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return fn as (input: unknown) => Effect.Effect<unknown, unknown>
}

/** Mutations record the server-reported change set and apply it to the cache that ran them. */
const mutation = (
  fn: (input: unknown) => Effect.Effect<unknown, unknown>,
  operation: string
): UseMutationOptions<unknown, unknown, unknown> => ({
  mutationFn: async (input, { client: cache }) => {
    const generation = cacheGeneration(cache)
    const changes = new Set<string>()
    const result = await runClientEffect(
      fn(input).pipe(Effect.provideService(ClientChanges, changes))
    )
    if (generation === cacheGeneration(cache))
      await applyMutationResult(cache, operation, result, [...changes])
    return result
  },
})

/** Options are derived once; React and Router consume native TanStack Query APIs. */
export function createModelQueries<M extends ModelCatalog>(
  model: M,
  // The model alone fixes M; inferring it back through the client's mapped
  // types is unbounded work for the compiler.
  client: NoInfer<EffectClient<M>>
): ModelQueries<M> {
  const result: Record<string, unknown> = Object.fromEntries(
    modelObjects(model).map((object) => {
      const group: unknown = Reflect.get(client, object.id)
      if (typeof group !== "object" || group === null)
        throw new Error(`Missing model object ${object.id}`)
      const operations: Record<string, unknown> = {}
      for (const { id: name } of modelObjectQueries(model, object)) {
        const fn = method(group, name)
        operations[name] = (input: unknown = {}) =>
          modelQuery(
            [object.id],
            name,
            input,
            (signal) => runClientEffect(fn(input), signal),
            name !== "get" && name !== "list" && name !== "batchGet"
          )
      }
      for (const { id: name } of modelObjectActions(model, object)) {
        const fn = method(group, name)
        operations[name] = () => mutation(fn, name)
      }
      for (const traversal of modelObjectLinkTraversals(model, object)) {
        const key = traversal.traversal.key
        const links = Reflect.get(group, key)
        const types = modelObjects(model)
          .filter((candidate) =>
            modelTypeAccepts(model, candidate.id, traversal.target.from.typeId)
          )
          .map((candidate) => candidate.id)
        const list = method(links, "list")
        operations[key] = {
          list: (input: unknown) =>
            modelQuery([object.id, ...types], `${key}.list`, input, (signal) =>
              runClientEffect(list(input), signal)
            ),
          ...Object.fromEntries(
            ["link", "unlink"]
              .filter((name) => Object.hasOwn(links, name))
              .map((name) => [name, () => mutation(method(links, name), name)])
          ),
        }
      }
      return [object.id, operations]
    })
  )
  for (const operation of [
    ...Object.values(model.actions),
    ...Object.values(model.queries),
  ]) {
    if (operation.objectType !== undefined) continue
    const fn = method(client, operation.id)
    result[operation.id] =
      operation.kind === "query"
        ? (input: unknown = {}) =>
            modelQuery(
              [],
              operation.id,
              input,
              (signal) => runClientEffect(fn(input), signal),
              true
            )
        : () => mutation(fn, operation.id)
  }
  const searchableTypes = modelObjects(model)
    .filter((object) => object.search !== undefined)
    .map((object) => object.id)
  result.records = {
    batchGet: (input: RecordBatchInput) =>
      modelQuery(
        modelObjects(model).map((object) => object.id),
        "records.batchGet",
        input,
        (signal) => runClientEffect(client.records.batchGet(input), signal)
      ),
    search: (input: RecordSearchInput) =>
      modelQuery(
        input.objectTypes ?? searchableTypes,
        "records.search",
        input,
        (signal) => runClientEffect(client.records.search(input), signal)
      ),
  }
  // SAFETY: every query, action and traversal is projected above from the same model.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return result as ModelQueries<M>
}

/** Imperative UI flows use the same mutation lifecycle as useMutation. */
export function executeMutation<A, E, Input>(
  cache: QueryClient,
  options: UseMutationOptions<A, E, Input>,
  input: Input
) {
  return new MutationObserver(cache, options).mutate(input)
}

export type ObjectQueryClient<
  O extends ObjectType,
  M extends ModelCatalog = ModelCatalog,
> = ObjectQueries<
  Extract<
    CustomOperations<M>,
    { readonly objectType: O["id"]; readonly kind: "query" }
  >["id"],
  ModelObjectClient<M, O>
>
