import { QueryClient } from "@tanstack/react-query"

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
        gcTime: 300_000,
        retry: false,
        refetchOnWindowFocus: true,
      },
      mutations: { retry: false },
    },
  })
  let identity: string | undefined
  return {
    queryClient,
    reset: () => {
      resetModelCache(queryClient)
    },
    invalidate: (types: ReadonlyArray<string>) =>
      invalidateModelQueries(queryClient, types),
    setIdentity: (next: string) => {
      if (identity !== undefined && identity !== next) {
        generations.set(queryClient, cacheGeneration(queryClient) + 1)
        queryClient.clear()
      }
      identity = next
    },
    dispose: () => queryClient.clear(),
  }
}

/** Custom reports are conservatively refreshed; feature code never declares write sets. */
export function invalidateModelQueries(
  queryClient: QueryClient,
  types: ReadonlyArray<string>
) {
  if (types.length === 0) return
  const changed = new Set(types)
  const permissions = [
    "role",
    "roleAssignment",
    "groupMembership",
    "user",
    "serviceAccount",
  ].some((type) => changed.has(type))
  if (permissions) {
    resetModelCache(queryClient)
    return
  }
  void queryClient.invalidateQueries({
    predicate: (query) =>
      query.queryKey[0] === "model" &&
      (changed.has("*") ||
        query.meta?.custom === true ||
        (Array.isArray(query.meta?.objectTypes) &&
          query.meta.objectTypes.some((type: string) => changed.has(type)))),
  })
}

let browserClient: ReturnType<typeof createModelDataClient> | undefined
export function modelData() {
  if (typeof window === "undefined")
    throw new Error(
      "Use the router's request-scoped query client on the server."
    )
  return (browserClient ??= createModelDataClient())
}
