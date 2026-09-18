import {
  hashKey,
  useQueries,
  useQuery,
  type UseQueryResult,
} from "@tanstack/react-query"
import { useCallback, useMemo, useState } from "react"

import { isNewerOrEqualRecord } from "#/runtime/client/model-cache.ts"
import { isUnavailable } from "#/runtime/client/query-errors.ts"
import type { ListRequest, Page } from "#/runtime/model/index.ts"
import type { ClientRecord } from "#/runtime/ui/model/object-client.ts"
import type { ObjectCollectionList } from "#/runtime/ui/model/use-object-collection.ts"

const initialPages = [0]

function combinePages(
  results: Array<UseQueryResult<Page<ClientRecord>, unknown>>
) {
  return {
    data: results.map((result) =>
      isUnavailable(result.error) ? undefined : result.data
    ),
    error: results.find((result) => result.error)?.error ?? null,
    isFetching: results.some((result) => result.isFetching),
    refetch: () => Promise.all(results.map((result) => result.refetch())),
  }
}

export interface TableRange {
  readonly startIndex: number
  readonly endIndex: number
  readonly prefetchRowCount: number
  readonly retainedIndices: ReadonlyArray<number>
}

/** Data stays several viewports ahead of the rendered rows, with bounded subscriptions. */
export function viewportPageIndices(
  { startIndex, endIndex, prefetchRowCount, retainedIndices }: TableRange,
  pageSize: number,
  totalSize: number
): ReadonlyArray<number> {
  const lastPage = Math.max(0, Math.ceil(totalSize / pageSize) - 1)
  const start = Math.max(
    0,
    Math.floor((startIndex - prefetchRowCount) / pageSize)
  )
  const end = Math.min(
    lastPage,
    Math.floor((endIndex + prefetchRowCount) / pageSize)
  )
  return [
    ...new Set([
      0,
      ...Array.from(
        { length: Math.max(0, end - start + 1) },
        (_, index) => start + index
      ),
      ...retainedIndices
        .filter((index) => index >= 0 && index < totalSize)
        .map((index) => Math.floor(index / pageSize)),
    ]),
  ].sort((a, b) => a - b)
}

/** Subscribe to the viewport, leaving previously visited pages in Query's inactive cache. */
export function useViewportPages(
  list: ObjectCollectionList,
  request: ListRequest
) {
  const firstQuery = list.queryOptions(request)
  const key = hashKey(firstQuery.queryKey)
  const pageSize = request.pageSize ?? 100
  const [requested, setRequested] = useState<{
    key: string
    pages: ReadonlyArray<number>
  }>({ key, pages: [0] })
  const first = useQuery(firstQuery)
  const firstData = isUnavailable(first.error) ? undefined : first.data
  const totalSize = firstData?.totalSize ?? 0
  const pages = requested.key === key ? requested.pages : initialPages
  const offsets = useMemo(
    () => pages.filter((page) => page > 0 && page * pageSize < totalSize),
    [pages, pageSize, totalSize]
  )
  const others = useQueries({
    combine: combinePages,
    queries: offsets.map((page) =>
      list.queryOptions({ ...request, pageOffset: page * pageSize })
    ),
  })
  const data = useMemo(() => {
    const batches = [
      { offset: 0, data: firstData },
      ...others.data.map((page, index) => ({
        offset: offsets[index]! * pageSize,
        data: page,
      })),
    ]
    const records = new Map<string, ClientRecord>()
    const indices = new Map<string, number>()
    const recordPages: Array<ReadonlyArray<ClientRecord>> = []
    for (const batch of batches) {
      if (!batch.data) continue
      recordPages.push(batch.data.items)
      batch.data.items.forEach((record, index) => {
        const previous = records.get(record.id)
        if (!previous || isNewerOrEqualRecord(record, previous))
          records.set(record.id, record)
        indices.set(record.id, batch.offset + index)
      })
    }
    return {
      recordsById: records,
      records: [...records.values()],
      indices,
      recordPages,
    }
  }, [firstData, others.data, offsets, pageSize])
  const onRangeChange = useCallback(
    (range: TableRange) => {
      const next = viewportPageIndices(range, pageSize, totalSize)
      setRequested((current) =>
        current.key === key &&
        current.pages.length === next.length &&
        current.pages.every((page, index) => page === next[index])
          ? current
          : { key, pages: next }
      )
    },
    [key, pageSize, totalSize]
  )
  return {
    ...data,
    totalSize,
    onRangeChange,
    error: first.error ?? others.error,
    isPending: first.isPending,
    isFetching: first.isFetching || others.isFetching,
    refetch: () => Promise.all([first.refetch(), others.refetch()]),
  }
}
