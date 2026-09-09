import { describe, expect, it } from "vitest"

import {
  Account,
  fixtureModel,
  Memo,
  Order,
  Prospect,
} from "#/runtime/testing/fixture-model.ts"
import { testPresentation } from "#/runtime/testing/presentation.ts"
import { FormValidationError } from "#/runtime/ui/forms/form-errors.ts"
import {
  dateTimeLocalValue,
  decodeObjectForm,
  objectFormFieldRequired,
  objectFormDefaultValues,
  objectFormLinks,
  objectFormProperties,
} from "#/runtime/ui/model/object-form.ts"

const presentation = testPresentation(fixtureModel)

describe("object forms", () => {
  it("preserves initial relationship targets through create decoding", () => {
    const values = objectFormDefaultValues(
      presentation,
      Memo,
      "create",
      undefined,
      new Date(),
      {
        content: "Follow up",
        links: { topics: ["prospect-one"] },
      }
    )
    expect(values.links).toEqual({ topics: ["prospect-one"] })
    expect(
      decodeObjectForm(presentation, Memo, values, "create")
    ).toMatchObject({
      content: "Follow up",
      links: { topics: ["prospect-one"] },
    })
    expect(
      objectFormDefaultValues(
        presentation,
        Memo,
        "edit",
        undefined,
        new Date(),
        {
          links: { topics: ["prospect-one"] },
        }
      ).links
    ).toEqual({ topics: { add: [], remove: [] } })
  })
  it("keeps focused updates separate from other fields and relationship drafts", () => {
    expect(
      decodeObjectForm(
        presentation,
        Account,
        {
          name: "",
          website: "https://example.com",
          links: { people: { add: ["person-other"] } },
        },
        "edit",
        ["website"]
      )
    ).toEqual({ website: "https://example.com" })
    expect(() =>
      decodeObjectForm(presentation, Account, { name: "" }, "edit", ["name"])
    ).toThrow("Name is required")
  })
  it("derives controlled defaults from the model", () => {
    expect(
      objectFormDefaultValues(presentation, Account, "create")
    ).toMatchObject({
      domain: "",
      stage: "prospect",
      links: { people: [] },
      logo: { alt: "", assetId: "" },
      name: "",
    })

    expect(
      objectFormDefaultValues(presentation, Prospect, "create")
    ).toMatchObject({
      source: "unknown",
      status: "new",
    })
  })

  it("keeps non-null fields required when the server supplies a default", () => {
    expect(objectFormFieldRequired(Prospect.properties.status)).toBe(true)
    expect(objectFormFieldRequired(Prospect.properties.email)).toBe(false)
  })

  it("omits action-owned output fields from create and edit forms", () => {
    for (const mode of ["create", "edit"] as const) {
      expect(
        objectFormProperties(Prospect, mode).map(({ id }) => id)
      ).not.toEqual(
        expect.arrayContaining([
          "convertedAt",
          "convertedAccount",
          "convertedPerson",
        ])
      )
    }
  })

  it("decodes semantic values without transport-specific form logic", () => {
    const form = {
      amount: { amount: "12500.00", currency: "eur" },
      expectedCloseDate: "2026-09-30",
      owner: null,
      nextStep: null,
      nextStepDate: null,
      name: "Expansion",
      parent: "account_northstar",
      stage: "quoted",
    }

    expect(decodeObjectForm(presentation, Order, form, "create")).toEqual({
      amount: { amount: "12500.00", currency: "EUR" },
      expectedCloseDate: "2026-09-30",
      owner: null,
      nextStep: null,
      nextStepDate: null,
      name: "Expansion",
      parent: "account_northstar",
      stage: "quoted",
    })
  })

  it("omits root parents and server-owned defaults", () => {
    const form = { domain: "northstar.example", name: "Northstar" }

    expect(decodeObjectForm(presentation, Account, form, "create")).toEqual({
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
      links: { topics: ["account_northstar", "person_ada"] },
    }

    expect(decodeObjectForm(presentation, Memo, form, "create")).toEqual({
      content: "Introductory call",
      links: { topics: ["account_northstar", "person_ada"] },
    })
  })

  it("derives writable edit relationships and decodes Link deltas", () => {
    expect(
      objectFormLinks(presentation, Account, "edit").map(
        ({ traversal }) => traversal.key
      )
    ).toEqual(["people"])
    expect(
      objectFormDefaultValues(presentation, Account, "edit").links
    ).toEqual({ people: { add: [], remove: [] } })
    expect(
      decodeObjectForm(
        presentation,
        Account,
        {
          stage: "prospect",
          links: {
            people: {
              add: ["person_grace"],
              remove: ["person_ada"],
            },
          },
          name: "Northstar",
        },
        "edit"
      )
    ).toMatchObject({
      links: {
        people: {
          add: ["person_grace"],
          remove: ["person_ada"],
        },
      },
    })
  })

  it("formats timestamps for datetime-local in local time", () => {
    expect(dateTimeLocalValue("2026-08-25T18:30:00.000Z")).toMatch(
      /^2026-08-25T\d{2}:30$/
    )
  })

  it("derives writable memo topics from the model", () => {
    expect(objectFormDefaultValues(presentation, Memo, "create")).toEqual({
      content: "",
      links: { topics: [] },
    })
  })

  it("preserves model validation paths for inline errors", () => {
    const form = { domain: "test", name: "Invalid" }

    try {
      decodeObjectForm(presentation, Account, form, "create")
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
