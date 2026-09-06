import { describe, expect, it } from "vitest"

import { createModelDataClient, resetModelCache } from "./data-client"
import { applyModelChanges, applyMutationResult } from "./model-cache"
import { modelQuery } from "./model-query-client"

const record = (etag: string) => ({
  id: "company_test",
  etag,
  name: `Revision ${etag}`,
})

describe("committed cache changes", () => {
  it("updates all appearances without inferring collection membership and rejects older snapshots", async () => {
    const { queryClient: cache, dispose } = createModelDataClient()
    const list = modelQuery(["company"], "list", {}, async () => ({
      items: [record("1")],
      totalSize: 1,
    }))
    const get = modelQuery(
      ["company"],
      "get",
      { id: "company_test" },
      async () => record("1")
    )
    try {
      await Promise.all([cache.fetchQuery(list), cache.fetchQuery(get)])
      await applyMutationResult(cache, record("3"), ["company"])
      await applyMutationResult(cache, record("2"), ["company"])
      expect(cache.getQueryData(get.queryKey)?.etag).toBe("3")
      expect(cache.getQueryData(list.queryKey)?.items[0]?.etag).toBe("3")
      await applyMutationResult(cache, { ...record("1"), id: "company_new" }, [
        "company",
      ])
      expect(cache.getQueryData(list.queryKey)?.items).toHaveLength(1)
      await applyModelChanges(
        cache,
        [{ record: record("4"), deleted: true }],
        ["company"]
      )
      expect(cache.getQueryData(get.queryKey)).toBeUndefined()
      expect(cache.getQueryData(list.queryKey)?.items).toEqual([])
    } finally {
      dispose()
    }
  })
  it("cancels a stale in-flight read before applying the committed snapshot", async () => {
    const { queryClient: cache, dispose } = createModelDataClient()
    let resolve: ((value: ReturnType<typeof record>) => void) | undefined
    let slow = false
    const get = modelQuery(
      ["company"],
      "get",
      { id: "company_test" },
      async () =>
        slow
          ? new Promise<ReturnType<typeof record>>((done) => {
              resolve = done
            })
          : record("1")
    )
    try {
      await cache.fetchQuery(get)
      slow = true
      const pending = cache
        .fetchQuery({ ...get, staleTime: 0 })
        .catch(() => undefined)
      await applyMutationResult(cache, record("2"), ["company"])
      resolve?.(record("1"))
      await pending
      expect(cache.getQueryData(get.queryKey)?.etag).toBe("2")
      const applying = applyMutationResult(cache, record("3"), ["company"])
      resetModelCache(cache)
      await applying
      expect(cache.getQueryData(get.queryKey)).toBeUndefined()
    } finally {
      dispose()
    }
  })
})
