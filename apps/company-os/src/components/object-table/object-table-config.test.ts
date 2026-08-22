import { describe, expect, it } from "vitest"

import { matchesObjectTableFilter } from "./object-table-config"

describe("matchesObjectTableFilter", () => {
  it("matches text operators without case sensitivity", () => {
    expect(
      matchesObjectTableFilter("Northwind Traders", {
        operator: "contains",
        values: ["WIND"],
      })
    ).toBe(true)
    expect(
      matchesObjectTableFilter("Northwind Traders", {
        operator: "doesNotContain",
        values: ["south"],
      })
    ).toBe(true)
  })

  it("treats multiple equality values as any-of semantics", () => {
    expect(
      matchesObjectTableFilter("customer", {
        operator: "equals",
        values: ["prospect", "customer"],
      })
    ).toBe(true)
    expect(
      matchesObjectTableFilter("inactive", {
        operator: "notEquals",
        values: ["prospect", "customer"],
      })
    ).toBe(true)
  })

  it("compares numbers numerically", () => {
    expect(
      matchesObjectTableFilter(12, {
        operator: "atLeast",
        values: ["10"],
      })
    ).toBe(true)
    expect(
      matchesObjectTableFilter(8, {
        operator: "greaterThan",
        values: ["10"],
      })
    ).toBe(false)
  })

  it("compares ISO dates and handles empty values", () => {
    expect(
      matchesObjectTableFilter("2026-08-21", {
        operator: "onOrAfter",
        values: ["2026-08-01"],
      })
    ).toBe(true)
    expect(
      matchesObjectTableFilter(null, { operator: "empty", values: [] })
    ).toBe(true)
    expect(
      matchesObjectTableFilter("Acme", { operator: "notEmpty", values: [] })
    ).toBe(true)
  })
})
