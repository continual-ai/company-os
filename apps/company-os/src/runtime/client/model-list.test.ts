import { InfiniteQueryObserver } from "@tanstack/react-query"
import { expect, it } from "vitest"

import {
  createModelDataClient,
  resetModelCache,
  invalidateModelQueries,
} from "#/runtime/client/model-cache.ts"
import {
  modelQuery,
  modelPagedQuery,
} from "#/runtime/client/model-query-client.ts"
import { PageToken, type ListRequest } from "#/runtime/model/index.ts"

it("reuses the loader, retains pages on failure, and rebuilds cursors on refresh", async () => {
  const { queryClient: cache, dispose } = createModelDataClient()
  let rows = [1, 2, 3, 4, 5]
  let fail = false
  const calls: Array<string | undefined> = []
  const list = (request: ListRequest) =>
    modelQuery(["company"], "list", request, async () => {
      calls.push(request.pageToken)
      if (fail && request.pageToken) throw new Error("Connection interrupted")
      const items = rows
        .filter((id) => id > Number(request.pageToken ?? -1))
        .slice(0, 2)
      return {
        items: items.map((id) => ({ id: `company_${id}`, etag: "1" })),
        totalSize: rows.length,
        nextPageToken:
          items.at(-1) === rows.at(-1) ? null : PageToken(String(items.at(-1))),
      }
    })
  const query = modelPagedQuery(list).infiniteQueryOptions({ pageSize: 2 })
  try {
    await cache.ensureInfiniteQueryData(query)
    const observer = new InfiniteQueryObserver(cache, query)
    const unsubscribe = observer.subscribe(() => undefined)
    try {
      expect(calls).toEqual([undefined])
      fail = true
      await observer.fetchNextPage()
      expect(observer.getCurrentResult().isFetchNextPageError).toBe(true)
      expect(observer.getCurrentResult().data?.pages).toHaveLength(1)
      fail = false
      await observer.fetchNextPage()
      expect(observer.getCurrentResult().data?.pages).toHaveLength(2)
      rows = [0, ...rows]
      calls.length = 0
      await observer.refetch()
      expect(calls).toEqual([undefined, "1"])
      expect(
        observer
          .getCurrentResult()
          .data?.pages.flatMap((page) => page.items.map((item) => item.id))
      ).toEqual(["company_0", "company_1", "company_2", "company_3"])
    } finally {
      unsubscribe()
    }
  } finally {
    dispose()
  }
})

const fixedList = (request: ListRequest) =>
  modelQuery(["company"], "list", request, async () => ({
    items: [{ id: request.pageToken ? "company_2" : "company_1", etag: "1" }],
    nextPageToken: request.pageToken ? null : PageToken("next"),
    totalSize: 2,
  }))

it("invalidates loaded pages without reconstructing their contents and drops pages on permission reset", async () => {
  const { queryClient: cache, dispose } = createModelDataClient()
  const query = modelPagedQuery(fixedList).infiniteQueryOptions({})
  try {
    await cache.fetchInfiniteQuery({ ...query, pages: 2 })
    await invalidateModelQueries(cache, ["company"])
    expect(cache.getQueryState(query.queryKey)?.isInvalidated).toBe(true)
    expect(cache.getQueryData(query.queryKey)?.pages).toHaveLength(2)
    expect(cache.getQueryData(query.queryKey)?.pageParams).toEqual([
      undefined,
      "next",
    ])
    resetModelCache(cache)
    expect(cache.getQueryData(query.queryKey)).toBeUndefined()
  } finally {
    dispose()
  }
})
