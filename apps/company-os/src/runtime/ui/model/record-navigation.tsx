import { hashKey, useInfiniteQuery } from "@tanstack/react-query"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { modelCollectionQuery } from "#/runtime/client/model-collection-query.ts"
import type { ListRequest } from "#/runtime/model/index.ts"
import {
  clientFor,
  type ModelObject,
} from "#/runtime/ui/model/object-client.ts"
import { objectListRequest } from "#/runtime/ui/model/object-collection-query.ts"
import { objectHref } from "#/runtime/ui/model/object-routing.ts"
import { useModelRuntime } from "#/runtime/ui/model/runtime-context.tsx"

interface CollectionSource {
  readonly objectId: string
  readonly request: ListRequest
  readonly href: string
}

export interface RecordNavigation {
  readonly position: number
  readonly total: number
  readonly previousHref?: string | undefined
  readonly nextHref?: string | undefined
  readonly hasNextPage: boolean
  readonly loading: boolean
  readonly error?: string | undefined
  readonly loadNext: () => Promise<string | undefined>
}

const CollectionNavigationContext = createContext<
  | {
      readonly sources: ReadonlyMap<string, CollectionSource>
      readonly remember: (source: CollectionSource) => void
    }
  | undefined
>(undefined)

/** Retains collection queries while their records are browsed; nested relationship lists do not register. */
export function CollectionNavigationProvider({
  children,
}: {
  children: ReactNode
}) {
  const [sources, setSources] = useState<ReadonlyMap<string, CollectionSource>>(
    new Map()
  )
  const remember = useCallback((source: CollectionSource) => {
    setSources((current) => {
      if (hashKey([current.get(source.objectId)]) === hashKey([source]))
        return current
      return new Map(current).set(source.objectId, source)
    })
  }, [])
  const value = useMemo(() => ({ sources, remember }), [sources, remember])
  return (
    <CollectionNavigationContext.Provider value={value}>
      {children}
    </CollectionNavigationContext.Provider>
  )
}

export function useRememberCollection(source: CollectionSource | undefined) {
  const context = useContext(CollectionNavigationContext)
  const remember = context?.remember
  useEffect(() => {
    if (source) remember?.(source)
  }, [source, remember])
}

export function useRecordNavigation(
  object: ModelObject,
  recordId: string,
  enabled: boolean
) {
  const runtime = useModelRuntime()
  const source = useContext(CollectionNavigationContext)?.sources.get(object.id)
  const client = useMemo(() => clientFor(runtime, object), [runtime, object])
  const page = useInfiniteQuery({
    ...modelCollectionQuery(
      client.list,
      source?.request ?? objectListRequest(object, [], [])
    ),
    enabled,
  })
  const ids = useMemo(
    () => [
      ...new Set(
        page.data?.pages.flatMap((result) =>
          result.items.map((item) => item.id)
        ) ?? []
      ),
    ],
    [page.data]
  )
  const index = ids.indexOf(recordId)
  const { fetchNextPage } = page
  const loadNext = useCallback(async () => {
    const result = await fetchNextPage({ cancelRefetch: false })
    if (result.isError) return undefined
    const loaded = [
      ...new Set(
        result.data?.pages.flatMap((batch) =>
          batch.items.map((item) => item.id)
        ) ?? []
      ),
    ]
    const current = loaded.indexOf(recordId)
    const next = current < 0 ? undefined : loaded[current + 1]
    return next === undefined ? undefined : objectHref(runtime, object, next)
  }, [fetchNextPage, recordId, runtime, object])
  const navigation = useMemo<RecordNavigation | undefined>(() => {
    if (!enabled || index < 0) return undefined
    const previous = ids[index - 1]
    const next = ids[index + 1]
    return {
      position: index + 1,
      total: page.data?.pages[0]?.totalSize ?? ids.length,
      previousHref:
        previous === undefined
          ? undefined
          : objectHref(runtime, object, previous),
      nextHref:
        next === undefined ? undefined : objectHref(runtime, object, next),
      hasNextPage: page.hasNextPage,
      loading: page.isFetchingNextPage,
      error: page.isFetchNextPageError
        ? "Could not load the next record. Try again."
        : undefined,
      loadNext,
    }
  }, [
    enabled,
    index,
    ids,
    page.data,
    page.hasNextPage,
    page.isFetchingNextPage,
    page.isFetchNextPageError,
    runtime,
    object,
    loadNext,
  ])
  return {
    navigation,
    collectionHref: source?.href ?? objectHref(runtime, object),
  }
}
