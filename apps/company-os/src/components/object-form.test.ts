import { Model } from "@company/model"
import { describe, expect, it } from "vitest"

import { FormValidationError } from "./form-errors"
import { dateTimeLocalValue, decodeObjectForm } from "./object-form"

describe("object forms", () => {
  it("decodes semantic CRM values without transport-specific form logic", () => {
    const form = new FormData()
    form.set("parent", "company_northstar")
    form.set("name", "Expansion")
    form.set("stage", "qualified")
    form.set("amount.amount", "12500.00")
    form.set("amount.currency", "eur")
    form.set("expectedCloseDate", "2026-09-30")

    expect(decodeObjectForm(Model.objects.deal, form, "create")).toEqual({
      amount: { amount: "12500.00", currency: "EUR" },
      expectedCloseDate: "2026-09-30",
      name: "Expansion",
      parent: "company_northstar",
      stage: "qualified",
    })
  })

  it("omits root parents and server-owned defaults", () => {
    const form = new FormData()
    form.set("name", "Northstar")
    form.set("domain", "northstar.example")

    expect(decodeObjectForm(Model.objects.company, form, "create")).toEqual({
      domain: "northstar.example",
      industry: null,
      logo: null,
      name: "Northstar",
      website: null,
    })
  })

  it("formats timestamps for datetime-local in local time", () => {
    expect(dateTimeLocalValue("2026-08-25T18:30:00.000Z")).toMatch(
      /^2026-08-25T\d{2}:30$/
    )
  })

  it("preserves model validation paths for inline errors", () => {
    const form = new FormData()
    form.set("name", "Invalid")
    form.set("domain", "test")

    try {
      decodeObjectForm(Model.objects.company, form, "create")
      throw new Error("Expected validation to fail.")
    } catch (cause) {
      expect(cause).toBeInstanceOf(FormValidationError)
      if (!(cause instanceof FormValidationError)) throw cause
      expect(cause.violations).toEqual([
        expect.objectContaining({ path: ["domain"] }),
      ])
    }
  })
})
