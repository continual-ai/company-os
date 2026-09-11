import { describe, expect, it } from "vitest"

import { Model } from "#/app.model.ts"
import { enableModules } from "#/runtime/model/index.ts"

describe("module enablement", () => {
  it("hides disabled objects without changing storage", () => {
    const sales = enableModules(Model, ["platform", "notes", "sales"])
    expect(Object.keys(sales.modules)).toEqual(["platform", "notes", "sales"])
    expect(sales.objects).toHaveProperty("lead")
    expect(sales.objects).not.toHaveProperty("ticket")
    expect(Model.objects).toHaveProperty("ticket")
  })

  it("names the missing dependency when a list is not closed", () => {
    expect(() =>
      enableModules(Model, ["platform", "notes", "support"])
    ).toThrow(
      /Module 'support' depends on module 'sales' \(link 'ticketCompany' references 'company'\), which is not enabled\./
    )
  })

  it("rejects ids that are not composed", () => {
    // @ts-expect-error unknown module ids are compile-time errors too
    expect(() => enableModules(Model, ["platform", "billing"])).toThrow(
      /Unknown enabled module 'billing'/
    )
  })
})
