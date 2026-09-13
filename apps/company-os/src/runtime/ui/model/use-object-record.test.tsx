import { QueryClientProvider } from "@tanstack/react-query"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"

import { createEffectClient } from "#/runtime/client/create-client.ts"
import { createModelDataClient } from "#/runtime/client/model-cache.ts"
import { createModelQueries } from "#/runtime/client/model-query-client.ts"
import type { ErrorStatus } from "#/runtime/model/definition/error.ts"
import { fixtureModel, Account } from "#/runtime/testing/fixture-model.ts"
import { testPresentation } from "#/runtime/testing/presentation.ts"
import { clientFor } from "#/runtime/ui/model/object-client.ts"
import { ModelUiProvider } from "#/runtime/ui/model/runtime-context.tsx"
import { useObjectRecord } from "#/runtime/ui/model/use-object-record.ts"

it.each<ErrorStatus>([
  "NOT_FOUND",
  "UNAUTHENTICATED",
  "PERMISSION_DENIED",
  "UNAVAILABLE",
])(
  "handles a background %s without leaving an unavailable record editable",
  async (status) => {
    const { queryClient, dispose } = createModelDataClient()
    const data = createModelQueries(
      fixtureModel,
      createEffectClient(fixtureModel, { baseUrl: "https://unused.test" })
    )
    const runtime = { ...testPresentation(fixtureModel), data }
    const options = clientFor(runtime, Account).get({ id: "account_test" })
    const before = {
      id: "account_test",
      etag: "1",
      name: "Cached account",
      objectType: "account",
    }
    const error = {
      status,
      reason: "READ_FAILED",
      message: "Refresh failed",
      details: {},
    }
    function Probe() {
      const result = useObjectRecord(Account, before.id)
      return (
        <div>
          {typeof result.record?.name === "string"
            ? result.record.name
            : "unavailable"}
          |{String(result.canDelete)}|{result.error}
        </div>
      )
    }
    try {
      await queryClient.fetchQuery({ ...options, queryFn: async () => before })
      await expect(
        queryClient.fetchQuery({
          ...options,
          staleTime: 0,
          queryFn: async () => {
            throw error
          },
        })
      ).rejects.toEqual(error)
      // Query intentionally retains the old response even when the refresh returns 404/403.
      expect(queryClient.getQueryData(options.queryKey)).toEqual(before)
      const html = renderToStaticMarkup(
        <QueryClientProvider client={queryClient}>
          <ModelUiProvider value={runtime}>
            <Probe />
          </ModelUiProvider>
        </QueryClientProvider>
      )
      expect(html).toContain(
        status === "UNAVAILABLE" ? "Cached account" : "unavailable|false"
      )
      expect(html).toContain("Refresh failed")
    } finally {
      dispose()
    }
  }
)
