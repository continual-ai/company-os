import {
  QueryClient,
  QueryClientProvider,
  hashKey,
} from "@tanstack/react-query"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"

import { modelCollectionQuery } from "#/runtime/client/model-collection-query.ts"
import { modelQuery } from "#/runtime/client/model-query-client.ts"
import { capabilityKey } from "#/runtime/contract/capabilities.ts"
import type { ListRequest, Page } from "#/runtime/model/index.ts"
import { Account, fixtureModel } from "#/runtime/testing/fixture-model.ts"
import { testPresentation } from "#/runtime/testing/presentation.ts"
import type { ClientRecord } from "#/runtime/ui/model/object-client.ts"
import { objectListRequest } from "#/runtime/ui/model/object-collection-query.ts"
import { ModelUiProvider } from "#/runtime/ui/model/runtime-context.tsx"
import { useObjectCollection } from "#/runtime/ui/model/use-object-collection.ts"

const list = (request: ListRequest) =>
  modelQuery<Page<ClientRecord>, unknown>(
    ["account"],
    "list",
    request,
    async () => ({
      items: [],
      totalSize: 2,
      nextPageToken: null,
    })
  )
const unused = () =>
  modelQuery(["account"], "unused", {}, async () => undefined)
function Preview() {
  const collection = useObjectCollection(Account, [], [])
  return (
    <output>
      {JSON.stringify({
        create: collection.canCreate,
        edit: collection.canUpdate("account_one"),
        actor: collection.referenceLabels.get("user_z"),
        nextActor: collection.referenceLabels.get("user_a"),
        count: collection.records.length,
      })}
    </output>
  )
}

it("retains existing actions and reference labels while appended pages resolve, then clears decisions on an access reset", async () => {
  const cache = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  })
  const pending = new Map<string, () => Promise<unknown>>()
  const remember = <T,>(query: ReturnType<typeof modelQuery<T, unknown>>) => {
    pending.set(hashKey(query.queryKey), () => cache.fetchQuery(query))
    return query
  }
  const runtime = {
    ...testPresentation(fixtureModel),
    data: {
      account: { list, get: unused, batchGet: unused },
      anonymousActor: { list, get: unused, batchGet: unused },
      serviceAccount: {
        get: unused,
        batchGet: unused,
        list: (request: ListRequest) =>
          modelQuery(["serviceAccount"], "list", request, async () => ({
            items: [],
          })),
      },
      user: {
        get: unused,
        batchGet: unused,
        list: (request: ListRequest) =>
          remember(
            modelQuery(["user"], "list", request, async () => {
              const ids =
                request.filter &&
                "value" in request.filter &&
                Array.isArray(request.filter.value)
                  ? request.filter.value
                  : []
              return {
                items: ids.map((id) => ({
                  id,
                  etag: "1",
                  name: id === "user_z" ? "Zoe" : "Ada",
                })),
              }
            })
          ),
      },
    },
    capabilities: (
      checks: Parameters<ReturnType<typeof testPresentation>["capabilities"]>[0]
    ) =>
      remember(
        modelQuery(["@iam"], "check", checks, async () =>
          checks.map(capabilityKey)
        )
      ),
  }
  const query = modelCollectionQuery(list, objectListRequest(Account, [], []))
  const first = {
    items: [{ id: "account_one", etag: "1", name: "One", createdBy: "user_z" }],
    totalSize: 2,
    nextPageToken: null,
  }
  const second = {
    items: [{ id: "account_two", etag: "1", name: "Two", createdBy: "user_a" }],
    totalSize: 2,
    nextPageToken: null,
  }
  const render = () =>
    renderToStaticMarkup(
      <QueryClientProvider client={cache}>
        <ModelUiProvider value={runtime}>
          <Preview />
        </ModelUiProvider>
      </QueryClientProvider>
    )
  try {
    cache.setQueryData(query.queryKey, {
      pages: [first],
      pageParams: [undefined],
    })
    expect(render()).toContain("&quot;create&quot;:false")
    await Promise.all([...pending.values()].map((load) => load()))
    expect(render()).toContain("&quot;actor&quot;:&quot;Zoe&quot;")
    cache.setQueryData(query.queryKey, {
      pages: [first, second],
      pageParams: [undefined, undefined],
    })
    const appending = render()
    expect(appending).toContain("&quot;create&quot;:true")
    expect(appending).toContain("&quot;edit&quot;:true")
    expect(appending).toContain("&quot;actor&quot;:&quot;Zoe&quot;")
    expect(appending).not.toContain("nextActor")
    expect(appending).toContain("&quot;count&quot;:2")
    await Promise.all([...pending.values()].map((load) => load()))
    expect(render()).toContain("&quot;nextActor&quot;:&quot;Ada&quot;")
    await cache.resetQueries({ queryKey: ["model", "@iam"] })
    expect(render()).toContain("&quot;create&quot;:false")
    expect(render()).toContain("&quot;edit&quot;:false")
  } finally {
    cache.clear()
  }
})
