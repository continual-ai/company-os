import { describe, expect, it } from "vitest"

import { safeReturnTo } from "./auth-navigation"

describe("authentication navigation", () => {
  it("preserves same-origin paths, queries, and fragments", () => {
    expect(safeReturnTo("/objects/company?page=2#active")).toBe(
      "/objects/company?page=2#active"
    )
  })

  it("falls back to the application root for external or invalid targets", () => {
    expect(safeReturnTo("https://attacker.example/sign-in")).toBe("/")
    expect(safeReturnTo("//attacker.example/sign-in")).toBe("/")
    expect(safeReturnTo(undefined)).toBe("/")
  })
})
