import { QueryObserver } from "@tanstack/react-query"
import { describe, expect, it, vi } from "vitest"

import {
  createModelDataClient,
  resetModelCache,
  invalidateModelQueries,
  applyChanges,
} from "#/runtime/client/model-cache.ts"
import { modelQuery } from "#/runtime/client/model-query-client.ts"

it("refetches affected expanded results and leaves unrelated queries untouched", async () => {
  const { queryClient: cache, dispose } = createModelDataClient()
  let name = "Before"
  const query = modelQuery(
    ["person", "account"],
    "get",
    { id: "person_1", expand: true },
    async () => ({
      id: "person_1",
      links: { account: { id: "account_1", name } },
    })
  )
  const unrelated = modelQuery(["ticket"], "list", {}, async () => ({
    items: [],
  }))
  await Promise.all([cache.fetchQuery(query), cache.fetchQuery(unrelated)])
  const observer = new QueryObserver(cache, query)
  const unsubscribe = observer.subscribe(() => {})
  try {
    name = "After"
    await invalidateModelQueries(cache, ["account"])
    expect(cache.getQueryData(query.queryKey)?.links.account.name).toBe("After")
    expect(cache.getQueryState(unrelated.queryKey)?.isInvalidated).toBe(false)
  } finally {
    unsubscribe()
    dispose()
  }
})

it("marks inactive results stale without changing their shape or inventing membership", async () => {
  const { queryClient: cache, dispose } = createModelDataClient()
  const value = {
    items: [
      { id: "person_1", links: { accounts: { items: [], totalSize: 8 } } },
    ],
    totalSize: 20,
  }
  const query = modelQuery(
    ["person", "account"],
    "list",
    { expand: true },
    async () => value
  )
  try {
    await cache.fetchQuery(query)
    await invalidateModelQueries(cache, ["account"])
    expect(cache.getQueryData(query.queryKey)).toEqual(value)
    expect(cache.getQueryState(query.queryKey)?.isInvalidated).toBe(true)
  } finally {
    dispose()
  }
})

it("cancels an old request and cannot repopulate a reset cache", async () => {
  const { queryClient: cache, dispose } = createModelDataClient()
  let resolve: ((value: string) => void) | undefined
  let slow = false
  const query = modelQuery(["person"], "get", {}, () =>
    slow
      ? new Promise<string>((done) => {
          resolve = done
        })
      : Promise.resolve("initial")
  )
  try {
    await cache.fetchQuery(query)
    slow = true
    const pending = cache
      .fetchQuery({ ...query, staleTime: 0 })
      .catch(() => undefined)
    const invalidating = invalidateModelQueries(cache, ["person"])
    resetModelCache(cache)
    resolve?.("stale")
    await Promise.all([pending, invalidating])
    expect(cache.getQueryData(query.queryKey)).toBeUndefined()
  } finally {
    dispose()
  }
})

it("event resets discard cached results", async () => {
  const { queryClient: cache, dispose } = createModelDataClient()
  const query = modelQuery(["person"], "get", {}, async () => "private")
  try {
    await cache.fetchQuery(query)
    applyChanges(cache, {
      changedTypes: [],
      reset: true,
      hasMore: false,
      nextCursor: "next",
    })
    expect(cache.getQueryData(query.queryKey)).toBeUndefined()
  } finally {
    dispose()
  }
})

it("coalesces bursts and finishes an in-flight refresh before catching up", async () => {
  const { queryClient: cache, dispose } = createModelDataClient()
  let version = 0
  let release: (() => void) | undefined
  const request = vi.fn(async () => {
    const snapshot = version
    if (snapshot === 1)
      await new Promise<void>((resolve) => {
        release = resolve
      })
    return snapshot
  })
  const query = modelQuery(["person", "account"], "list", {}, request)
  await cache.fetchQuery(query)
  const observer = new QueryObserver(cache, query)
  const unsubscribe = observer.subscribe(() => {})
  try {
    version = 1
    const first = invalidateModelQueries(cache, ["account"])
    const second = invalidateModelQueries(cache, ["person"])
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2))
    version = 2
    const third = invalidateModelQueries(cache, ["account"])
    expect(request).toHaveBeenCalledTimes(2)
    release?.()
    await Promise.all([first, second, third])
    expect(request).toHaveBeenCalledTimes(3)
    expect(cache.getQueryData(query.queryKey)).toBe(2)
  } finally {
    release?.()
    unsubscribe()
    dispose()
  }
})

describe("model query cache", () => {
  it("deduplicates preload and component reads and invalidates actual changed types", async () => {
    const data = createModelDataClient()
    let companies = 0
    let contacts = 0
    const company = modelQuery(["company"], "list", {}, async () => ++companies)
    const contact = modelQuery(["contact"], "list", {}, async () => ++contacts)
    try {
      expect(
        await Promise.all([
          data.queryClient.fetchQuery(company),
          data.queryClient.fetchQuery(company),
          data.queryClient.fetchQuery(contact),
        ])
      ).toEqual([1, 1, 1])
      void data.invalidate(["company"])
      expect(
        await Promise.all([
          data.queryClient.fetchQuery(company),
          data.queryClient.fetchQuery(contact),
        ])
      ).toEqual([2, 1])
      void data.invalidate(["*"])
      expect(await data.queryClient.fetchQuery(contact)).toBe(2)
    } finally {
      data.dispose()
    }
  })
  it("removes private data on revocation and permits recovery through the same observer", async () => {
    const data = createModelDataClient()
    let allowed = true
    const options = modelQuery(
      ["company"],
      "get",
      { id: "private" },
      async () => {
        if (!allowed) throw new Error("Forbidden")
        return "private data"
      }
    )
    const observer = new QueryObserver(data.queryClient, options)
    const unsubscribe = observer.subscribe(() => undefined)
    try {
      expect(await data.queryClient.fetchQuery(options)).toBe("private data")
      allowed = false
      data.reset()
      expect(data.queryClient.getQueryData(options.queryKey)).toBeUndefined()
      await expect(data.queryClient.fetchQuery(options)).rejects.toThrow(
        "Forbidden"
      )
      allowed = true
      data.reset()
      expect(await data.queryClient.fetchQuery(options)).toBe("private data")
    } finally {
      unsubscribe()
      data.dispose()
    }
  })
  it("never shares results across identities and lets failed reads retry", async () => {
    const data = createModelDataClient()
    let name = "first"
    let failed = false
    const options = modelQuery(["company"], "get", {}, async () => {
      if (failed) throw new Error("Unavailable")
      return name
    })
    try {
      data.setIdentity("first")
      expect(await data.queryClient.fetchQuery(options)).toBe("first")
      name = "second"
      data.setIdentity("second")
      failed = true
      await expect(data.queryClient.fetchQuery(options)).rejects.toThrow(
        "Unavailable"
      )
      failed = false
      expect(await data.queryClient.fetchQuery(options)).toBe("second")
    } finally {
      data.dispose()
    }
  })
})

it("refreshes other queries while a report is still running", async () => {
  const { queryClient: cache, dispose } = createModelDataClient()
  let release: (() => void) | undefined
  let version = 0
  const report = modelQuery(["account"], "report", {}, async () => {
    if (version > 0)
      await new Promise<void>((resolve) => {
        release = resolve
      })
    return "report"
  })
  const table = modelQuery(["person"], "list", {}, async () => version)
  await Promise.all([cache.fetchQuery(report), cache.fetchQuery(table)])
  const reportObserver = new QueryObserver(cache, report)
  const tableObserver = new QueryObserver(cache, table)
  const stopReport = reportObserver.subscribe(() => {})
  const stopTable = tableObserver.subscribe(() => {})
  try {
    version = 1
    const refresh = invalidateModelQueries(cache, ["account"])
    await vi.waitFor(() => expect(release).toBeDefined())
    await invalidateModelQueries(cache, ["person"])
    expect(cache.getQueryData(table.queryKey)).toBe(1)
    expect(reportObserver.getCurrentResult().isFetching).toBe(true)
    release?.()
    await refresh
  } finally {
    release?.()
    stopReport()
    stopTable()
    dispose()
  }
})
