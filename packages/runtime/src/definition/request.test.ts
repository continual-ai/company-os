import { describe, expect, it } from "vitest"

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, normalizePageSize } from "./request"

describe("page-size normalization", () => {
  it("uses the default for omitted and zero values", () => {
    expect(normalizePageSize()).toBe(DEFAULT_PAGE_SIZE)
    expect(normalizePageSize(0)).toBe(DEFAULT_PAGE_SIZE)
  })

  it("preserves ordinary sizes and caps large requests", () => {
    expect(normalizePageSize(25)).toBe(25)
    expect(normalizePageSize(MAX_PAGE_SIZE + 1)).toBe(MAX_PAGE_SIZE)
  })

  it("rejects negative, fractional, and non-finite values", () => {
    expect(() => normalizePageSize(-1)).toThrow("non-negative integer")
    expect(() => normalizePageSize(1.5)).toThrow("non-negative integer")
    expect(() => normalizePageSize(Number.NaN)).toThrow("non-negative integer")
  })
})
