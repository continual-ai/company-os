import {
  QueryObserver,
  InfiniteQueryObserver,
  type InfiniteData,
} from "@tanstack/react-query"
import type { Effect } from "effect"
import { expect, expectTypeOf, it, vi } from "vitest"

import {
  createEffectClient,
  createClient,
} from "#/runtime/client/create-client.ts"
import {
  createModelDataClient,
  invalidateModelQueries,
} from "#/runtime/client/model-cache.ts"
import {
  createModelQueries,
  modelQuery,
  executeMutation,
} from "#/runtime/client/model-query-client.ts"
import type {
  RecordSearchOutput,
  SearchResult,
} from "#/runtime/contract/record-search.ts"
import type { ObjectRecord } from "#/runtime/model/definition/object.ts"
import {
  RecordId,
  defineLink,
  defineModel,
  defineModule,
  defineObject,
  schema,
  type PageToken,
  type Page,
} from "#/runtime/model/index.ts"
import {
  fixtureModel,
  type Person,
  type Account,
} from "#/runtime/testing/fixture-model.ts"

it("paginates search summaries with shared query options and invalidation", async () => {
  expectTypeOf<RecordSearchOutput>().toEqualTypeOf<Page<SearchResult>>()
  const calls: unknown[] = []
  const queries = createModelQueries(
    fixtureModel,
    createEffectClient(fixtureModel, {
      baseUrl: "https://company.test",
      fetch: async (url, init) => {
        const request = new Request(url, init)
        expect(new URL(request.url).pathname).toBe("/api/v1/records:search")
        const input: unknown = await request.json()
        calls.push(input)
        return Response.json({
          items: [
            {
              id: calls.length === 1 ? "account_first" : "account_second",
              objectType: "account",
              title: "Search summary",
              subtitle: null,
              image: null,
              status: null,
              snippets: [{ field: "website", text: "Matching context" }],
            },
          ],
          nextPageToken: calls.length === 1 ? "next" : null,
          totalSize: 2,
        })
      },
    })
  )
  const { queryClient: cache, dispose } = createModelDataClient()
  try {
    const input = { query: "context", objectTypes: ["account"], pageSize: 1 }
    const options = queries.records.search.infiniteQueryOptions(input)
    const result = await cache.fetchInfiniteQuery({ ...options, pages: 2 })
    expectTypeOf(result).toEqualTypeOf<
      InfiniteData<RecordSearchOutput, PageToken | undefined>
    >()
    expect(calls).toEqual([input, { ...input, pageToken: "next" }])
    expect(
      result.pages.flatMap((page) => page.items.map((hit) => hit.id))
    ).toEqual(["account_first", "account_second"])
    expect(result.pageParams).toEqual([undefined, "next"])
    expect(
      cache.getQueryData(queries.records.search.queryOptions(input).queryKey)
    ).toBeUndefined()
    expect(
      cache.getQueryData(
        queries.account.get.queryOptions({
          id: RecordId("account")("account_first"),
        }).queryKey
      )
    ).toBeUndefined()
    await invalidateModelQueries(cache, ["account"])
    expect(cache.getQueryState(options.queryKey)?.isInvalidated).toBe(true)
  } finally {
    dispose()
  }
})

it("rejects incomplete ordinary record responses", async () => {
  const client = createClient(fixtureModel, {
    baseUrl: "https://company.test",
    fetch: async () =>
      Response.json({ id: "account_incomplete", objectType: "account" }),
  })
  await expect(
    client.account.get({ id: RecordId("account")("account_incomplete") })
  ).rejects.toBeDefined()
})

it("generates native pagination options for collections and relationships", async () => {
  const calls: Array<{ path: string; input: unknown }> = []
  const queries = createModelQueries(
    fixtureModel,
    createEffectClient(fixtureModel, {
      baseUrl: "https://company.test",
      fetch: async (url) => {
        const parsed = new URL(url instanceof Request ? url.url : url)
        const path = parsed.pathname
        const input = Object.fromEntries(parsed.searchParams)
        calls.push({ path, input })
        return Response.json({
          items: [],
          totalSize: 0,
          nextPageToken: calls.length % 2 === 1 ? "next" : null,
        })
      },
    })
  )
  const { queryClient: cache, dispose } = createModelDataClient()
  try {
    const collection = queries.person.list.infiniteQueryOptions({
      expand: { billingAccount: true },
      pageSize: 1,
    })
    const result = await cache.fetchInfiniteQuery({ ...collection, pages: 2 })
    expectTypeOf(result).toEqualTypeOf<
      InfiniteData<
        Page<
          ObjectRecord<
            typeof Person,
            typeof fixtureModel,
            { readonly billingAccount: true }
          >
        >,
        PageToken | undefined
      >
    >()
    expect(result.pageParams).toEqual([undefined, "next"])
    expect(calls).toEqual([
      {
        path: "/api/v1/people",
        input: { expand: '{"billingAccount":true}', pageSize: "1" },
      },
      {
        path: "/api/v1/people",
        input: {
          expand: '{"billingAccount":true}',
          pageSize: "1",
          pageToken: "next",
        },
      },
    ])
    const relationship = queries.person.accounts.list.infiniteQueryOptions({
      id: RecordId("person")("person_example"),
      expand: { orders: true },
    })
    const related = await cache.fetchInfiniteQuery({
      ...relationship,
      pages: 2,
    })
    expectTypeOf(related.pages[0]!.items[0]!).toEqualTypeOf<
      ObjectRecord<
        typeof Account,
        typeof fixtureModel,
        { readonly orders: true }
      >
    >()
    expect(calls.slice(2)).toEqual([
      {
        path: "/api/v1/people/person_example/accounts",
        input: { expand: '{"orders":true}' },
      },
      {
        path: "/api/v1/people/person_example/accounts",
        input: { expand: '{"orders":true}', pageToken: "next" },
      },
    ])
    expect(relationship.meta?.objectTypes).toContain("order")
    // A component observes the loader's exact query without a second request.
    const observer = new InfiniteQueryObserver(cache, collection)
    const unsubscribe = observer.subscribe(() => undefined)
    expect(observer.getCurrentResult().data).toBe(result)
    expect(calls).toHaveLength(4)
    unsubscribe()
    await cache.fetchInfiniteQuery(queries.account.list.infiniteQueryOptions())
    expect(calls.at(-1)?.input).toEqual({})
    expect(queries.account.list.infiniteQueryOptions().queryKey).toEqual(
      queries.account.list.infiniteQueryOptions({}).queryKey
    )
  } finally {
    dispose()
  }
})

it("preserves required relationship capabilities when projecting the client", () => {
  const Thing = defineObject({
    id: "thing",
    collection: "things",
    name: "Thing",
    pluralName: "Things",
    properties: { name: schema.string() },
    display: { title: "name" },
  })
  const hierarchy = defineLink({
    id: "hierarchy",
    name: "Hierarchy",
    from: {
      object: Thing,
      key: "parentThing",
      label: "Parent thing",
      min: 1,
      max: 1,
    },
    to: { object: Thing, key: "children", label: "Children", min: 0 },
  })
  const model = defineModel({
    name: "Required relationships",
    modules: [
      defineModule({
        id: "test",
        name: "Test",
        interfaces: [],
        objects: [Thing],
        links: [hierarchy],
      }),
    ],
  })
  const client = createEffectClient(model, {
    baseUrl: "http://company.test",
    fetch: () => Promise.reject(new Error("No requests are made here.")),
  })
  const data = createModelQueries(model, client)
  expect(Object.keys(data.thing.parentThing)).toEqual(["get"])
  expect(Object.keys(data.thing.children)).toEqual(["list", "link", "unlink"])
  expect(data.records.search.queryOptions({ query: "a" }).meta).toMatchObject({
    objectTypes: ["thing"],
    operation: "records.search",
  })
  expectTypeOf<keyof typeof data.thing.parentThing>().toEqualTypeOf<"get">()
})

it("retains literal expansion types through Effect, Promise and query clients", () => {
  const effect = createEffectClient(fixtureModel, {
    baseUrl: "http://company.test",
  })
  const promise = createClient(fixtureModel, { baseUrl: "http://company.test" })
  const queries = createModelQueries(fixtureModel, effect)
  const id = RecordId("person")("person_example")
  const effectRead = effect.person.get({ id, expand: { billingAccount: true } })
  const promiseRead = () => promise.person.get({ id, expand: true })
  const queryRead = queries.person.get.queryOptions({ id, expand: true })
  expectTypeOf<Effect.Success<typeof effectRead>>().toEqualTypeOf<
    ObjectRecord<
      typeof Person,
      typeof fixtureModel,
      { readonly billingAccount: true }
    >
  >()
  expectTypeOf<Awaited<ReturnType<typeof promiseRead>>>().toEqualTypeOf<
    ObjectRecord<typeof Person, typeof fixtureModel, true>
  >()
  expectTypeOf<Awaited<ReturnType<typeof queryRead.queryFn>>>().toEqualTypeOf<
    ObjectRecord<typeof Person, typeof fixtureModel, true>
  >()
  expect(queryRead.queryKey).toContainEqual({ id, expand: true })
  expect(queryRead.meta.objectTypes).toContain("account")
})

it("invalidates reads for related filters, nested quantifiers, sorts and selected expansions", async () => {
  const queries = createModelQueries(
    fixtureModel,
    createEffectClient(fixtureModel, { baseUrl: "http://unused.test" })
  )
  const filtered = queries.person.list.queryOptions({
    filter: { field: "billingAccount.name", operator: "eq", value: "Acme" },
  })
  const sorted = queries.person.list.queryOptions({
    sort: [{ field: "accounts.name", aggregate: "min", direction: "asc" }],
  })
  const nested = queries.person.list.queryOptions({
    filter: { link: "accounts", some: { link: "orders", isEmpty: true } },
  })
  const expanded = queries.person.accounts.list.queryOptions({
    id: RecordId("person")("person_test"),
    expand: { orders: true },
  })
  expect(filtered.meta.objectTypes).toEqual(["person", "account"])
  expect(nested.meta.objectTypes).toEqual(["person", "account", "order"])
  expect(expanded.meta.objectTypes).toEqual(["person", "account", "order"])
  expect(sorted.meta.objectTypes).toEqual(["person", "account"])
  expect(
    queries.person.list.queryOptions({ expand: {} }).meta.objectTypes
  ).toEqual(["person"])
  expect(
    queries.person.list.queryOptions({ expand: { billingAccount: true } }).meta
      .objectTypes
  ).toEqual(["person", "account"])
  const { queryClient, dispose } = createModelDataClient()
  try {
    await queryClient.fetchQuery({
      ...filtered,
      queryFn: async () => ({ items: [], totalSize: 0, nextPageToken: null }),
    })
    await queryClient.fetchQuery({
      ...expanded,
      queryFn: async () => ({ items: [], totalSize: 0, nextPageToken: null }),
    })
    void invalidateModelQueries(queryClient, ["account"])
    expect(queryClient.getQueryState(filtered.queryKey)?.isInvalidated).toBe(
      true
    )
    void invalidateModelQueries(queryClient, ["order"])
    expect(queryClient.getQueryState(expanded.queryKey)?.isInvalidated).toBe(
      true
    )
  } finally {
    dispose()
  }
})

it("completes a committed mutation without waiting for an unrelated report refresh", async () => {
  const { queryClient: cache, dispose } = createModelDataClient()
  const queries = createModelQueries(
    fixtureModel,
    createEffectClient(fixtureModel, {
      baseUrl: "https://company.test",
      fetch: async () =>
        new Response(null, {
          status: 204,
          headers: { "x-model-changes": "account" },
        }),
    })
  )
  let slow = false
  let release: (() => void) | undefined
  const report = modelQuery(["account"], "report", {}, async () => {
    if (slow)
      await new Promise<void>((resolve) => {
        release = resolve
      })
    return "report"
  })
  await cache.fetchQuery(report)
  const observer = new QueryObserver(cache, report)
  const unsubscribe = observer.subscribe(() => {})
  try {
    slow = true
    const refresh = invalidateModelQueries(cache, ["account"])
    await vi.waitFor(() => expect(release).toBeDefined())
    await expect(
      executeMutation(cache, queries.account.batchDelete.mutationOptions(), {
        ids: [RecordId("account")("account_test")],
      })
    ).resolves.toBeUndefined()
    expect(observer.getCurrentResult().isFetching).toBe(true)
    slow = false
    release?.()
    await refresh
  } finally {
    release?.()
    unsubscribe()
    dispose()
  }
})
