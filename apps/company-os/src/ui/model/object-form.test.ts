import { Model } from "@company/model"
import { describe, expect, it } from "vitest"

import { FormValidationError } from "@/ui/forms/form-errors"

import {
  dateTimeLocalValue,
  decodeObjectForm,
  objectFormDefaultValues,
} from "./object-form"

describe("object forms", () => {
  it("derives controlled defaults from the model", () => {
    expect(
      objectFormDefaultValues(Model.objects.company, "create")
    ).toMatchObject({
      domain: "",
      lifecycleStage: "prospect",
      links: { contacts: [] },
      logo: { alt: "", assetId: "" },
      name: "",
    })
  })

  it("decodes semantic sales values without transport-specific form logic", () => {
    const form = {
      amount: { amount: "12500.00", currency: "eur" },
      expectedCloseDate: "2026-09-30",
      name: "Expansion",
      parent: "company_northstar",
      stage: "qualified",
    }

    expect(decodeObjectForm(Model.objects.deal, form, "create")).toEqual({
      amount: { amount: "12500.00", currency: "EUR" },
      expectedCloseDate: "2026-09-30",
      name: "Expansion",
      parent: "company_northstar",
      stage: "qualified",
    })
  })

  it("omits root parents and server-owned defaults", () => {
    const form = { domain: "northstar.example", name: "Northstar" }

    expect(decodeObjectForm(Model.objects.company, form, "create")).toEqual({
      domain: "northstar.example",
      industry: null,
      logo: null,
      name: "Northstar",
      website: null,
    })
  })

  it("nests initial relationships under the generated links envelope", () => {
    const form = {
      links: { regarding: "company_northstar" },
      occurredAt: "2026-08-25T18:30",
      summary: "Introductory call",
    }

    expect(decodeObjectForm(Model.objects.interaction, form, "create")).toEqual(
      {
        details: null,
        links: { regarding: "company_northstar" },
        occurredAt: new Date("2026-08-25T18:30").toISOString(),
        summary: "Introductory call",
      }
    )
  })

  it("formats timestamps for datetime-local in local time", () => {
    expect(dateTimeLocalValue("2026-08-25T18:30:00.000Z")).toMatch(
      /^2026-08-25T\d{2}:30$/
    )
  })

  it("preserves model validation paths for inline errors", () => {
    const form = { domain: "test", name: "Invalid" }

    try {
      decodeObjectForm(Model.objects.company, form, "create")
      throw new Error("Expected validation to fail.")
    } catch (cause) {
      expect(cause).toBeInstanceOf(FormValidationError)
      if (!(cause instanceof FormValidationError)) throw cause
      expect(cause.violations).toEqual([
        {
          message: "Enter a valid domain name.",
          path: ["domain"],
          reason: "INVALID_DOMAIN",
        },
      ])
    }
  })
})
