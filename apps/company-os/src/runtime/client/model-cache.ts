import {
  QueryClient,
  type Query,
  type QueryFilters,
} from "@tanstack/react-query"

import type { ChangePage } from "#/runtime/contract/events.ts"

const generations = new WeakMap<QueryClient, number>()
export const cacheGeneration = (cache: QueryClient) =>
  generations.get(cache) ?? 0
export function resetModelCache(cache: QueryClient) {
  generations.set(cache, cacheGeneration(cache) + 1)
  void cache.resetQueries()
}

/** One cache per authenticated browser session; SSR creates a separate request cache. */
export function createModelDataClient() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: false,
      },
    },
  })
  let identity: string | undefined
  return {
    queryClient,
    reset: () => resetModelCache(queryClient),
    invalidate: (types: ReadonlyArray<string>) =>
      invalidateModelQueries(queryClient, types),
    setIdentity: (next: string) => {
      if (identity !== undefined && identity !== next) {
        generations.set(queryClient, cacheGeneration(queryClient) + 1)
        queryClient.clear()
      }
      identity = next
    },
    dispose: () => {
      generations.set(queryClient, cacheGeneration(queryClient) + 1)
      queryClient.clear()
    },
  }
}

const pending = new WeakMap<
  Query,
  { again: boolean; done: Promise<void>; generation: number }
>()

/** Mark stale immediately and coalesce refreshes independently, so a slow report cannot block a table. */
export async function invalidateModelQueries(
  cache: QueryClient,
  types: ReadonlyArray<string>
): Promise<void> {
  if (types.length === 0) return
  const affected = changedModelQueries(types)
  void cache.invalidateQueries({ ...affected, refetchType: "none" })
  await Promise.all(
    cache
      .getQueryCache()
      .findAll(affected)
      .filter((query) => query.isActive())
      .map((query) => {
        const generation = cacheGeneration(cache)
        const existing = pending.get(query)
        if (existing && existing.generation === generation) {
          existing.again = true
          return existing.done
        }
        const batch = { again: true, done: Promise.resolve(), generation }
        batch.done = (async () => {
          try {
            while (batch.again && generation === cacheGeneration(cache)) {
              await new Promise<void>((resolve) => setTimeout(resolve, 25))
              if (generation !== cacheGeneration(cache)) return
              batch.again = false
              const exact = {
                predicate: (candidate: Query) => candidate === query,
              }
              // Cancellation replaces an obsolete read; keep its last settled state until refresh completes.
              await cache.cancelQueries(exact)
              if (generation !== cacheGeneration(cache)) return
              await cache.invalidateQueries(exact)
            }
          } finally {
            if (pending.get(query) === batch) pending.delete(query)
          }
        })()
        pending.set(query, batch)
        return batch.done
      })
  )
}

export function applyChanges(cache: QueryClient, page: ChangePage) {
  if (page.reset) {
    resetModelCache(cache)
    return
  }
  // Applying a notice schedules its refresh; feed progress never waits for a slow report.
  void invalidateModelQueries(cache, page.changedTypes)
}

/** Compare stored record revisions when expanded and batch results overlap. */
export function isNewerOrEqualRecord(
  incoming: { readonly etag: string },
  current: { readonly etag: string }
) {
  return BigInt(incoming.etag) >= BigInt(current.etag)
}

/** Cancellation and invalidation use the same model dependencies. */
function changedModelQueries(types: ReadonlyArray<string>): QueryFilters {
  const changed = new Set(types)
  return {
    predicate: (query) =>
      query.queryKey[0] === "model" &&
      (changed.has("*") ||
        query.meta?.custom === true ||
        (Array.isArray(query.meta?.objectTypes) &&
          query.meta.objectTypes.some((type: string) => changed.has(type)))),
  }
}

let browserClient: ReturnType<typeof createModelDataClient> | undefined
export function modelData() {
  if (typeof window === "undefined")
    throw new Error(
      "Use the router's request-scoped query client on the server."
    )
  return (browserClient ??= createModelDataClient())
}
