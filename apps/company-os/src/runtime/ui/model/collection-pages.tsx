import { useInfiniteQuery } from "@tanstack/react-query"
import { useMemo, type ReactNode } from "react"

import { isNewerOrEqualRecord } from "#/runtime/client/model-cache.ts"
import { isUnavailable } from "#/runtime/client/query-errors.ts"
import type { ListRequest } from "#/runtime/model/index.ts"
import type { ClientRecord } from "#/runtime/ui/model/object-client.ts"
import type { ObjectTableProps } from "#/runtime/ui/model/object-table/object-table.tsx"
import type { ObjectCollectionList } from "#/runtime/ui/model/use-object-collection.ts"
import { useViewportPages } from "#/runtime/ui/model/use-viewport-pages.ts"

export interface CollectionPages {
  readonly records: ReadonlyArray<ClientRecord>
  readonly recordsById: ReadonlyMap<string, ClientRecord>
  readonly recordPages: ReadonlyArray<ReadonlyArray<ClientRecord>>
  readonly totalSize: number
  readonly totalSizeExact: boolean
  readonly error: unknown
  readonly isPending: boolean
  readonly isFetching: boolean
  readonly load: () => Promise<unknown>
  readonly viewport?: ObjectTableProps["viewport"]
  readonly pagination?: {
    readonly hasNextPage: boolean
    readonly onNextPage: () => void
  }
}

export interface CollectionPagesProps {
  readonly list: ObjectCollectionList
  readonly request: ListRequest
  readonly children: (pages: CollectionPages) => ReactNode
}

/** Each layout mounts only its own query observers; Query owns the cache. */
export function ViewportCollectionPages({
  list,
  request,
  children,
}: CollectionPagesProps) {
  const pages = useViewportPages(list, request)
  return children({
    ...pages,
    load: pages.refetch,
    viewport: {
      rowCount: pages.rowCount,
      totalSize: pages.totalSize,
      totalSizeExact: pages.totalSizeExact,
      loading: pages.isFetching,
      indices: pages.indices,
      onRangeChange: pages.onRangeChange,
    },
  })
}

export function InfiniteCollectionPages({
  list,
  request,
  children,
}: CollectionPagesProps) {
  return children(useInfiniteCollectionPages(list, request))
}

export function useInfiniteCollectionPages(
  list: ObjectCollectionList,
  request: ListRequest
): CollectionPages {
  const page = useInfiniteQuery(list.infiniteQueryOptions(request))
  const data = isUnavailable(page.error) ? undefined : page.data
  const records = useMemo(() => {
    const recordsById = new Map<string, ClientRecord>()
    const recordPages = data?.pages.map((batch) => batch.items) ?? []
    for (const batch of recordPages)
      for (const record of batch) {
        const previous = recordsById.get(record.id)
        if (!previous || isNewerOrEqualRecord(record, previous))
          recordsById.set(record.id, record)
      }
    return { records: [...recordsById.values()], recordsById, recordPages }
  }, [data])
  return {
    ...records,
    totalSize: data?.pages[0]?.totalSize ?? 0,
    totalSizeExact: data?.pages[0]?.totalSizeExact ?? true,
    error: page.error,
    isPending: page.isPending,
    isFetching: page.isFetching,
    load: () =>
      page.isFetchNextPageError
        ? page.fetchNextPage({ cancelRefetch: false })
        : page.refetch(),
    pagination: {
      hasNextPage: page.hasNextPage,
      onNextPage: () => {
        if (page.hasNextPage && !page.isFetching)
          void page.fetchNextPage({ cancelRefetch: false })
      },
    },
  }
}
