import { describe, expect, it } from "vitest"

import {
  createModelDataClient,
  resetModelCache,
} from "#/runtime/client/data-client.ts"
import {
  applyEventPage,
  applyModelChanges,
  applyMutationResult,
} from "#/runtime/client/model-cache.ts"
import { modelQuery } from "#/runtime/client/model-query-client.ts"
import { fixtureModel } from "#/runtime/testing/fixture-model.ts"

const record = (etag: string) => ({
  id: "account_test",
  etag,
  name: `Revision ${etag}`,
})

describe("committed cache changes", () => {
  it("updates all appearances without inferring collection membership and rejects older snapshots", async () => {
    const { queryClient: cache, dispose } = createModelDataClient()
    const list = modelQuery(["account"], "list", {}, async () => ({
      items: [record("1")],
      totalSize: 1,
    }))
    const get = modelQuery(
      ["account"],
      "get",
      { id: "account_test" },
      async () => record("1")
    )
    try {
      await Promise.all([cache.fetchQuery(list), cache.fetchQuery(get)])
      await applyMutationResult(cache, "update", record("3"), ["account"])
      await applyMutationResult(cache, "update", record("2"), ["account"])
      expect(cache.getQueryData(get.queryKey)?.etag).toBe("3")
      expect(cache.getQueryData(list.queryKey)?.items[0]?.etag).toBe("3")
      await applyMutationResult(
        cache,
        "update",
        { ...record("1"), id: "account_new" },
        ["account"]
      )
      expect(cache.getQueryData(list.queryKey)?.items).toHaveLength(1)
      await applyModelChanges(
        cache,
        [{ record: record("4"), deleted: true }],
        ["account"]
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
      ["account"],
      "get",
      { id: "account_test" },
      async () => record("1")
    )
    try {
      await cache.fetchQuery(get)
      await applyMutationResult(
        cache,
        "inspect",
        {
          id: "account_test",
          etag: "99",
          name: "Receipt title",
          accepted: true,
        },
        ["account"]
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
      ["account"],
      "get",
      { id: "account_test" },
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
        "account",
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
  const person = {
    id: "person_test",
    etag: "1",
    name: "Current name",
    aliases: [],
    metadata: {},
    objectType: "person",
    links: {},
    systemManaged: false,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    createdBy: "user_test",
    updatedBy: "user_test",
    photo: null,
    email: null,
    phone: null,
    consent: "unknown",
  }
  const get = modelQuery(
    ["person"],
    "get",
    { id: person.id },
    async () => person
  )
  const envelope = {
    id: "event_test",
    transactionId: "transaction_test",
    actorId: "user_test",
    occurredAt: person.updatedAt,
    recordedAt: person.updatedAt,
    subjects: [{ id: person.id, objectType: "person" }],
    version: 1,
  }
  const page = { nextCursor: "opaque", hasMore: false, reset: false }
  try {
    await cache.fetchQuery(get)
    for (const event of [
      {
        ...envelope,
        type: "person.updated",
        data: { id: person.id, etag: "99", name: null },
      },
      {
        ...envelope,
        type: "person.inspected",
        data: { ...person, etag: "99", name: "Receipt" },
      },
    ]) {
      await applyEventPage(cache, { ...page, items: [event] }, fixtureModel)
      expect(cache.getQueryData(get.queryKey)).toEqual(person)
      expect(cache.getQueryState(get.queryKey)?.isInvalidated).toBe(true)
    }
    await applyEventPage(
      cache,
      {
        ...page,
        items: [
          {
            ...envelope,
            type: "person.updated",
            data: { ...person, etag: "2", name: "Updated name" },
          },
        ],
      },
      fixtureModel
    )
    expect(cache.getQueryData(get.queryKey)?.name).toBe("Updated name")
    await applyEventPage(
      cache,
      {
        ...page,
        items: [
          {
            ...envelope,
            type: "person.deleted",
            data: { id: person.id, etag: "3" },
          },
        ],
      },
      fixtureModel
    )
    expect(cache.getQueryData(get.queryKey)).toBeUndefined()
  } finally {
    dispose()
  }
})
