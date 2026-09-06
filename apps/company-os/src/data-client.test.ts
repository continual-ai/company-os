import { Effect } from "effect"
import { AtomRegistry } from "effect/unstable/reactivity"
import { describe, expect, it } from "vitest"

import { createModelDataClient, observeQuery } from "./data-client"

describe("company data", () => {
  it("shares in-flight reads and refreshes only affected object types", async () => {
    const data = createModelDataClient()
    try {
      let companies = 0
      let contacts = 0
      const company = () =>
        data.read(
          "company",
          "list",
          {},
          Effect.sync(() => ++companies)
        )
      const contact = () =>
        data.read(
          "contact",
          "list",
          {},
          Effect.sync(() => ++contacts)
        )
      expect(await Promise.all([company(), company(), contact()])).toEqual([
        1, 1, 1,
      ])
      data.invalidate(["company"])
      expect(await Promise.all([company(), contact()])).toEqual([2, 1])
      data.invalidate(["roleAssignment"])
      expect(await Promise.all([company(), contact()])).toEqual([3, 2])
    } finally {
      data.dispose()
    }
  })

  it("refreshes observed hydration dependencies without reloading the owning record", async () => {
    const data = createModelDataClient()
    let leadReads = 0
    let companyReads = 0
    let companyName = "Before"
    const query = observeQuery(
      Effect.gen(function* () {
        const lead = yield* data.query(
          "lead",
          "get",
          { id: "lead" },
          Effect.sync(() => {
            leadReads++
            return { company: "company" }
          })
        )
        return yield* data.query(
          "company",
          "get",
          { id: lead.company },
          Effect.sync(() => {
            companyReads++
            return companyName
          })
        )
      })
    )
    const unmount = data.registry.mount(query)
    const read = () =>
      Effect.runPromise(
        AtomRegistry.getResult(data.registry, query, { suspendOnWaiting: true })
      )
    try {
      expect(await read()).toBe("Before")
      companyName = "After"
      data.invalidate(["company"])
      expect(await read()).toBe("After")
      expect(leadReads).toBe(1)
      expect(companyReads).toBe(2)
    } finally {
      unmount()
      data.dispose()
    }
  })

  it("allows a failed request to be retried immediately", async () => {
    const data = createModelDataClient()
    try {
      let available = false
      const request = Effect.suspend(() =>
        available ? Effect.succeed("recovered") : Effect.fail("unavailable")
      )
      await expect(
        data.read("company", "get", { id: "one" }, request)
      ).rejects.toBeDefined()
      available = true
      expect(await data.read("company", "get", { id: "one" }, request)).toBe(
        "recovered"
      )
    } finally {
      data.dispose()
    }
  })

  it("does not reuse authenticated results across identity changes", async () => {
    const data = createModelDataClient()
    try {
      data.setIdentity("one")
      expect(
        await data.read("company", "list", {}, Effect.succeed("one"))
      ).toBe("one")
      data.setIdentity("two")
      expect(
        await data.read("company", "list", {}, Effect.succeed("two"))
      ).toBe("two")
    } finally {
      data.dispose()
    }
  })
})

it("clears observed records on a permission reset and recovers through the same query", async () => {
  const data = createModelDataClient()
  let allowed = true
  const query = observeQuery(
    data.query(
      "company",
      "get",
      { id: "private" },
      Effect.suspend(() =>
        allowed ? Effect.succeed("private data") : Effect.fail("forbidden")
      )
    )
  )
  const unmount = data.registry.mount(query)
  const read = () =>
    Effect.runPromise(
      AtomRegistry.getResult(data.registry, query, { suspendOnWaiting: true })
    )
  try {
    expect(await read()).toBe("private data")
    allowed = false
    data.reset()
    await expect(read()).rejects.toBeDefined()
    allowed = true
    data.reset()
    expect(await read()).toBe("private data")
  } finally {
    unmount()
    data.dispose()
  }
})
