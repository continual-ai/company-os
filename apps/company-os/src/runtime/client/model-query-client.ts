import {
  MutationObserver,
  infiniteQueryOptions,
  queryOptions as tanstackQueryOptions,
  type QueryClient,
  type InfiniteData,
  type UseMutationOptions,
} from "@tanstack/react-query"
import { Effect } from "effect"

import {
  ClientChanges,
  type EffectClient,
  runClientEffect,
} from "#/runtime/client/create-client.ts"
import {
  mapModelClient,
  type ModelClient,
  type CustomOperations,
} from "#/runtime/client/http-client.ts"
import {
  cacheGeneration,
  invalidateModelQueries,
} from "#/runtime/client/model-cache.ts"
import type {
  ReadProjection,
  PolymorphicReads,
} from "#/runtime/client/read-types.ts"
import {
  modelObjects,
  modelTypeAccepts,
  type ModelCatalog,
  type ModelObject,
  type ListRequest,
  type Page,
  type PageToken,
} from "#/runtime/model/index.ts"
import { queryDependencies } from "#/runtime/model/query-dependencies.ts"

export function modelQuery<A, E = unknown>(
  objectTypes: ReadonlyArray<string>,
  operation: string,
  input: unknown,
  request: (signal: AbortSignal) => Promise<A>,
  custom = false
) {
  const queryFn = ({ signal }: { signal: AbortSignal }) => request(signal)
  const meta = { objectTypes, custom, operation }
  return {
    ...tanstackQueryOptions<A, E>({
      queryKey: ["model", objectTypes[0], operation, input],
      queryFn,
      meta,
    }),
    queryFn,
    meta,
  }
}

export type ModelQueryOptions<A, E = unknown> = ReturnType<
  typeof modelQuery<A, E>
>
/** The cursor adapter lives on collection operations, alongside their ordinary query options. */
export function modelList<A, E = unknown, Input extends object = ListRequest>(
  queryOptions: (
    input: Input
  ) => Pick<ModelQueryOptions<Page<A>, E>, "queryKey" | "queryFn" | "meta">
) {
  return {
    queryOptions,
    infiniteQueryOptions: (input: Input) => {
      const first = queryOptions(input)
      return infiniteQueryOptions<
        Page<A>,
        E,
        InfiniteData<Page<A>, PageToken | undefined>,
        ReadonlyArray<unknown>,
        PageToken | undefined
      >({
        queryKey: [...first.queryKey, "pages"],
        meta: { ...first.meta, paginated: true },
        initialPageParam: undefined as PageToken | undefined,
        queryFn: ({ pageParam, signal }) =>
          queryOptions({
            ...input,
            ...(pageParam === undefined ? {} : { pageToken: pageParam }),
          }).queryFn({ signal }),
        getNextPageParam: (page) => page.nextPageToken ?? undefined,
      })
    },
  }
}

export type ModelInfiniteQueryOptions<A, E = unknown> = ReturnType<
  ReturnType<typeof modelList<A, E>>["infiniteQueryOptions"]
>

type QueryMethod<T> = T extends (
  ...args: infer Args
) => Effect.Effect<infer A, infer E>
  ? { readonly queryOptions: (...args: Args) => ModelQueryOptions<A, E> }
  : never
type MutationMethod<T> = T extends (
  input: infer Input
) => Effect.Effect<infer A, infer E>
  ? { readonly mutationOptions: () => UseMutationOptions<A, E, Input> }
  : never
type ObjectQueries<QueryIds extends PropertyKey, C> = {
  readonly [K in keyof C]: C[K] extends (...args: never[]) => unknown
    ? K extends "get" | "list" | "batchGet" | QueryIds
      ? QueryMethod<C[K]>
      : MutationMethod<C[K]>
    : {
        readonly [L in keyof C[K]]: L extends "list" | "get"
          ? QueryMethod<C[K][L]>
          : MutationMethod<C[K][L]>
      }
}
export type ModelQueries<M extends ModelCatalog> = {
  readonly [O in ModelObject<M> as O["id"]]: ReadProjection<
    M,
    O,
    ObjectQueries<
      Extract<
        CustomOperations<M>,
        { readonly objectType: O["id"]; readonly kind: "query" }
      >["id"],
      ModelClient<M>[O["id"]]
    >,
    "query"
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
  readonly records: PolymorphicReads<M, "query"> & {
    readonly search: QueryMethod<EffectClient<M>["records"]["search"]>
  }
}

/** Mutations record the server-reported change set and apply it to the cache that ran them. */
const mutation = (
  fn: (input: unknown) => Effect.Effect<unknown, unknown>
): UseMutationOptions<unknown, unknown, unknown> => ({
  mutationFn: async (input, { client: cache }) => {
    const generation = cacheGeneration(cache)
    const changes = new Set<string>()
    const result = await runClientEffect(
      fn(input).pipe(Effect.provideService(ClientChanges, changes))
    )
    if (generation === cacheGeneration(cache))
      void invalidateModelQueries(cache, [...changes])
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
  const result = mapModelClient(model, client, (contract, fn) => {
    const path = contract.key.split(".")
    if (contract.kind === "action")
      return { mutationOptions: () => mutation(fn) }
    const queryOptions = (input: unknown = {}) => {
      const traversal = contract.linkTraversal
      const targets = traversal
        ? modelObjects(model).filter((object) =>
            modelTypeAccepts(model, object.id, traversal.target.from.typeId)
          )
        : contract.object
          ? [contract.object]
          : modelObjects(model)
      const dependencies = [
        ...new Set([
          ...(traversal ? [traversal.source.id] : []),
          ...queryDependencies(model, targets, input),
        ]),
      ]
      const custom =
        !contract.builtin &&
        !traversal &&
        contract.id !== "get" &&
        contract.id !== "list" &&
        contract.id !== "batchGet"
      return modelQuery(
        dependencies,
        contract.object ? path.slice(1).join(".") : contract.key,
        input,
        (signal) => runClientEffect(fn(input), signal),
        custom
      )
    }
    if (contract.object !== undefined && contract.id === "list") {
      // SAFETY: these standard collection contracts decode a Page before returning from the transport.
      return modelList(
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        queryOptions as (input: ListRequest) => ModelQueryOptions<Page<unknown>>
      )
    }
    return { queryOptions }
  })
  clients.set(result, model)
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

const clients = new WeakMap<object, ModelCatalog>()

/** The requested model may be the full application or a portable subset of its module definitions. */
export function modelQueriesFor<M extends ModelCatalog>(
  data: object,
  model: M
): ModelQueries<M> {
  const installed = clients.get(data)
  if (
    !installed ||
    Object.values(model.modules).some(
      (module) => installed.modules[module.id] !== module
    )
  )
    throw new Error(
      "The UI client was not created from this model's module definitions."
    )
  // SAFETY: createModelQueries registered this client, and every requested module is part of its model.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return data as ModelQueries<M>
}
