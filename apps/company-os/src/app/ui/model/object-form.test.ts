import { describe, expect, it } from "vitest"

import { Model } from "#/app.model.ts"
import { presentation } from "#/app/app-presentation.ts"
import { FormValidationError } from "#/runtime/ui/forms/form-errors.ts"
import {
  dateTimeLocalValue,
  decodeObjectForm,
  objectFormFieldRequired,
  objectFormDefaultValues,
  objectFormLinks,
  objectFormProperties,
} from "#/runtime/ui/model/object-form.ts"

describe("object forms", () => {
  it("preserves initial relationship targets through create decoding", () => {
    const values = objectFormDefaultValues(
      presentation,
      Model.objects.note,
      "create",
      undefined,
      new Date(),
      {
        content: "Follow up",
        links: { subjects: ["lead-one"] },
      }
    )
    expect(values.links).toEqual({ subjects: ["lead-one"] })
    expect(
      decodeObjectForm(presentation, Model.objects.note, values, "create")
    ).toMatchObject({ content: "Follow up", links: { subjects: ["lead-one"] } })
    expect(
      objectFormDefaultValues(
        presentation,
        Model.objects.note,
        "edit",
        undefined,
        new Date(),
        { links: { subjects: ["lead-one"] } }
      ).links
    ).toEqual({ subjects: { add: [], remove: [] } })
  })
  it("keeps focused updates separate from other fields and relationship drafts", () => {
    expect(
      decodeObjectForm(
        presentation,
        Model.objects.company,
        {
          name: "",
          website: "https://example.com",
          links: { contacts: { add: ["contact-other"] } },
        },
        "edit",
        ["website"]
      )
    ).toEqual({ website: "https://example.com" })
    expect(() =>
      decodeObjectForm(
        presentation,
        Model.objects.company,
        { name: "" },
        "edit",
        ["name"]
      )
    ).toThrow("Name is required")
  })
  it("derives controlled defaults from the model", () => {
    expect(
      objectFormDefaultValues(presentation, Model.objects.company, "create")
    ).toMatchObject({
      domain: "",
      lifecycleStage: "prospect",
      links: { contacts: [] },
      logo: { alt: "", assetId: "" },
      name: "",
    })

    expect(
      objectFormDefaultValues(presentation, Model.objects.lead, "create")
    ).toMatchObject({
      source: "unknown",
      status: "new",
    })
  })

  it("keeps non-null fields required when the server supplies a default", () => {
    expect(objectFormFieldRequired(Model.objects.lead.properties.status)).toBe(
      true
    )
    expect(objectFormFieldRequired(Model.objects.lead.properties.email)).toBe(
      false
    )
  })

  it("omits action-owned output fields from create and edit forms", () => {
    for (const mode of ["create", "edit"] as const) {
      expect(
        objectFormProperties(Model.objects.lead, mode).map(({ id }) => id)
      ).not.toEqual(
        expect.arrayContaining([
          "convertedAt",
          "convertedCompany",
          "convertedContact",
        ])
      )
    }
  })

  it("decodes semantic sales values without transport-specific form logic", () => {
    const form = {
      amount: { amount: "12500.00", currency: "eur" },
      expectedCloseDate: "2026-09-30",
      owner: null,
      nextStep: null,
      nextStepDate: null,
      name: "Expansion",
      parent: "company_northstar",
      stage: "qualified",
    }

    expect(
      decodeObjectForm(presentation, Model.objects.deal, form, "create")
    ).toEqual({
      amount: { amount: "12500.00", currency: "EUR" },
      expectedCloseDate: "2026-09-30",
      owner: null,
      nextStep: null,
      nextStepDate: null,
      name: "Expansion",
      parent: "company_northstar",
      stage: "qualified",
    })
  })

  it("omits root parents and server-owned defaults", () => {
    const form = { domain: "northstar.example", name: "Northstar" }

    expect(
      decodeObjectForm(presentation, Model.objects.company, form, "create")
    ).toEqual({
      domain: "northstar.example",
      industry: null,
      logo: null,
      name: "Northstar",
      website: null,
    })
  })

  it("nests initial relationships under the generated links envelope", () => {
    const form = {
      content: "Introductory call",
      links: { subjects: ["company_northstar", "contact_ada"] },
    }

    expect(
      decodeObjectForm(presentation, Model.objects.note, form, "create")
    ).toEqual({
      content: "Introductory call",
      links: { subjects: ["company_northstar", "contact_ada"] },
    })
  })

  it("derives writable edit relationships and decodes Link deltas", () => {
    expect(
      objectFormLinks(presentation, Model.objects.company, "edit").map(
        ({ traversal }) => traversal.key
      )
    ).toEqual(["contacts"])
    expect(
      objectFormDefaultValues(presentation, Model.objects.company, "edit").links
    ).toEqual({ contacts: { add: [], remove: [] } })
    expect(
      decodeObjectForm(
        presentation,
        Model.objects.company,
        {
          lifecycleStage: "prospect",
          links: {
            contacts: {
              add: ["contact_grace"],
              remove: ["contact_ada"],
            },
          },
          name: "Northstar",
        },
        "edit"
      )
    ).toMatchObject({
      links: {
        contacts: {
          add: ["contact_grace"],
          remove: ["contact_ada"],
        },
      },
    })
  })

  it("formats timestamps for datetime-local in local time", () => {
    expect(dateTimeLocalValue("2026-08-25T18:30:00.000Z")).toMatch(
      /^2026-08-25T\d{2}:30$/
    )
  })

  it("derives writable note subjects from the model", () => {
    expect(
      objectFormDefaultValues(presentation, Model.objects.note, "create")
    ).toEqual({
      content: "",
      links: { subjects: [] },
    })
  })

  it("preserves model validation paths for inline errors", () => {
    const form = { domain: "test", name: "Invalid" }

    try {
      decodeObjectForm(presentation, Model.objects.company, form, "create")
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
