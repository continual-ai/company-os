import { describe, expect, it } from "vitest"

import { createModelDataClient, resetModelCache } from "./data-client"
import {
  applyEventPage,
  applyModelChanges,
  applyMutationResult,
} from "./model-cache"
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
      await applyMutationResult(cache, "update", record("3"), ["company"])
      await applyMutationResult(cache, "update", record("2"), ["company"])
      expect(cache.getQueryData(get.queryKey)?.etag).toBe("3")
      expect(cache.getQueryData(list.queryKey)?.items[0]?.etag).toBe("3")
      await applyMutationResult(
        cache,
        "update",
        { ...record("1"), id: "company_new" },
        ["company"]
      )
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
  it("does not treat a custom action receipt as a canonical record", async () => {
    const { queryClient: cache, dispose } = createModelDataClient()
    const get = modelQuery(
      ["company"],
      "get",
      { id: "company_test" },
      async () => record("1")
    )
    try {
      await cache.fetchQuery(get)
      await applyMutationResult(
        cache,
        "inspect",
        {
          id: "company_test",
          etag: "99",
          name: "Receipt title",
          accepted: true,
        },
        ["company"]
      )
      expect(cache.getQueryData(get.queryKey)).toEqual(record("1"))
      expect(cache.getQueryState(get.queryKey)?.isInvalidated).toBe(true)
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
      await applyMutationResult(cache, "update", record("2"), ["*"])
      resolve?.(record("1"))
      await pending
      expect(cache.getQueryData(get.queryKey)?.etag).toBe("2")
      const applying = applyMutationResult(cache, "update", record("3"), [
        "company",
      ])
      resetModelCache(cache)
      await applying
      expect(cache.getQueryData(get.queryKey)).toBeUndefined()
    } finally {
      dispose()
    }
  })
})

it("revalidates incompatible historical snapshots without poisoning current records", async () => {
  const { queryClient: cache, dispose } = createModelDataClient()
  const contact = {
    id: "contact_test",
    etag: "1",
    name: "Current name",
    aliases: [],
    metadata: {},
    parent: "platform_system",
    systemManaged: false,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    createdBy: "user_test",
    updatedBy: "user_test",
    photo: null,
    jobTitle: null,
    email: null,
    phone: null,
    emailPermission: "unknown",
    marketingStatus: "nonMarketing",
  }
  const get = modelQuery(
    ["contact"],
    "get",
    { id: contact.id },
    async () => contact
  )
  const envelope = {
    id: "event_test",
    transactionId: "transaction_test",
    actorId: "user_test",
    occurredAt: contact.updatedAt,
    recordedAt: contact.updatedAt,
    subjects: [{ id: contact.id, objectType: "contact" }],
    version: 1,
  }
  const page = { nextCursor: "opaque", hasMore: false, reset: false }
  try {
    await cache.fetchQuery(get)
    for (const event of [
      {
        ...envelope,
        type: "contact.updated",
        data: { id: contact.id, etag: "99", name: null },
      },
      {
        ...envelope,
        type: "contact.inspected",
        data: { ...contact, etag: "99", name: "Receipt" },
      },
    ]) {
      await applyEventPage(cache, { ...page, items: [event] })
      expect(cache.getQueryData(get.queryKey)).toEqual(contact)
      expect(cache.getQueryState(get.queryKey)?.isInvalidated).toBe(true)
    }
    await applyEventPage(cache, {
      ...page,
      items: [
        {
          ...envelope,
          type: "contact.updated",
          data: { ...contact, etag: "2", name: "Updated name" },
        },
      ],
    })
    expect(cache.getQueryData(get.queryKey)?.name).toBe("Updated name")
    await applyEventPage(cache, {
      ...page,
      items: [
        {
          ...envelope,
          type: "contact.deleted",
          data: { id: contact.id, etag: "3" },
        },
      ],
    })
    expect(cache.getQueryData(get.queryKey)).toBeUndefined()
  } finally {
    dispose()
  }
})
