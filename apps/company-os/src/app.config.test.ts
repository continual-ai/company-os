import { describe, expect, it } from "vitest"

import { Model } from "#/app.model.ts"
import { enableModules } from "#/runtime/model/index.ts"

describe("module enablement", () => {
  it("hides disabled objects without changing storage", () => {
    const sales = enableModules(Model, ["platform", "notes", "crm", "sales"])
    expect(Object.keys(sales.modules)).toEqual([
      "platform",
      "notes",
      "crm",
      "sales",
    ])
    expect(sales.objects).toHaveProperty("lead")
    expect(sales.objects).not.toHaveProperty("ticket")
    expect(Model.objects).toHaveProperty("ticket")
  })

  it("names the missing dependency when a list is not closed", () => {
    expect(() =>
      enableModules(Model, ["platform", "notes", "service"])
    ).toThrow(
      /Module 'service' depends on module 'crm' \(link 'ticketAccount' references 'account'\), which is not enabled\./
    )
  })

  it("rejects ids that are not composed", () => {
    // @ts-expect-error unknown module ids are compile-time errors too
    expect(() => enableModules(Model, ["platform", "billing"])).toThrow(
      /Unknown enabled module 'billing'/
    )
  })
})
