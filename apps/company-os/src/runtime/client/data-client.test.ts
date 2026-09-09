import { QueryObserver } from "@tanstack/react-query"
import { describe, expect, it } from "vitest"

import { createModelDataClient } from "#/runtime/client/data-client.ts"
import { modelQuery } from "#/runtime/client/model-query-client.ts"

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
      data.invalidate(["company"])
      expect(
        await Promise.all([
          data.queryClient.fetchQuery(company),
          data.queryClient.fetchQuery(contact),
        ])
      ).toEqual([2, 1])
      data.invalidate(["roleAssignment"])
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
