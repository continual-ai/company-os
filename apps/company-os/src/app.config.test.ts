import { describe, expect, it } from "vitest"

import { Model } from "#/app.model.ts"
import { enableModules } from "#/runtime/model/index.ts"

describe("module enablement", () => {
  it("hides disabled objects without changing storage", () => {
    const sales = enableModules(Model, ["access", "assets", "notes", "sales"])
    expect(Object.keys(sales.modules)).toEqual([
      "access",
      "assets",
      "notes",
      "sales",
    ])
    expect(sales.objects).toHaveProperty("lead")
    expect(sales.objects).not.toHaveProperty("ticket")
    expect(Model.objects).toHaveProperty("ticket")
  })

  it("names the missing dependency when a list is not closed", () => {
    expect(() =>
      enableModules(Model, ["access", "assets", "notes", "support"])
    ).toThrow(
      /Module 'support' depends on module 'sales' \(object 'ticket' references 'company'\), which is not enabled\./
    )
  })

  it("rejects ids that are not composed", () => {
    // @ts-expect-error unknown module ids are compile-time errors too
    expect(() => enableModules(Model, ["access", "billing"])).toThrow(
      /Unknown enabled module 'billing'/
    )
  })
})
