import {
  MutationObserver,
  queryOptions,
  type QueryClient,
  type DataTag,
  type UseMutationOptions,
} from "@tanstack/react-query"
import { Cause, Context, Effect, Exit } from "effect"

import { cacheGeneration } from "#/runtime/client/data-client.ts"
import type {
  ModelClient,
  ModelObjectClient,
} from "#/runtime/client/http-client.ts"
import { applyMutationResult } from "#/runtime/client/model-cache.ts"
import {
  modelObjectLinkTraversals,
  modelObjects,
  modelTypeAccepts,
  type ModelCatalog,
  type ModelObject,
  type ObjectType,
} from "#/runtime/model/index.ts"

/** HTTP change headers belong to the invocation, including imperative mutations. */
export const ClientChanges = Context.Reference<Set<string> | undefined>(
  "@company/ClientChanges",
  { defaultValue: () => undefined }
)

export async function runClientEffect<A, E>(
  effect: Effect.Effect<A, E>,
  signal?: AbortSignal
): Promise<A> {
  const exit = await Effect.runPromiseExit(effect, { signal })
  if (Exit.isFailure(exit)) throw Cause.squash(exit.cause)
  return exit.value
}

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
type ObjectQueries<O extends { readonly queries: object }, C> = {
  readonly [K in keyof C]: C[K] extends (...args: never[]) => unknown
    ? K extends "get" | "list" | "batchGet" | keyof O["queries"]
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
    O,
    ModelClient<M>[O["id"]]
  >
}

const method = (group: object, name: string) => {
  const fn = Reflect.get(group, name)
  if (typeof fn !== "function")
    throw new Error(`Missing model operation ${name}`)
  // SAFETY: the implementation and projection are built from the same closed model.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return fn as (input: unknown) => Effect.Effect<unknown, unknown>
}

/** Options are derived once; React and Router consume native TanStack Query APIs. */
export function createModelQueries<M extends ModelCatalog>(
  model: M,
  // The model alone fixes M; inferring it back through the client's mapped
  // types is unbounded work for the compiler.
  client: NoInfer<ModelClient<M>>
): ModelQueries<M> {
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
  const result = Object.fromEntries(
    modelObjects(model).map((object) => {
      const group: unknown = Reflect.get(client, object.id)
      if (typeof group !== "object" || group === null)
        throw new Error(`Missing model object ${object.id}`)
      const operations: Record<string, unknown> = {}
      for (const name of [
        "get",
        "list",
        "batchGet",
        ...Object.keys(object.queries),
      ]) {
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
      for (const name of Object.keys(object.actions)) {
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

export type ObjectQueryClient<O extends ObjectType> = ObjectQueries<
  O,
  ModelObjectClient<ModelCatalog, O>
>
