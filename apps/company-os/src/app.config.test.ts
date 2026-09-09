import { describe, expect, it } from "vitest"

import { enabledModules } from "#/app.config.ts"
import { EnabledModel, Model } from "#/app.model.ts"
import { enableModules } from "#/runtime/model/index.ts"

describe("module enablement", () => {
  it("exposes the composed model unchanged when every module is enabled", () => {
    expect(enabledModules).toEqual(Object.keys(Model.modules))
    expect(EnabledModel).toBe(Model)
  })

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
    ).toThrow(/requires module 'sales'/)
  })

  it("rejects ids that are not composed", () => {
    // @ts-expect-error unknown module ids are compile-time errors too
    expect(() => enableModules(Model, ["access", "billing"])).toThrow(
      /Unknown enabled module 'billing'/
    )
  })
})
