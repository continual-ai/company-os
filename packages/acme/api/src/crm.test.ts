import {
  createApiDescription,
  type ActionError,
  type ActionInput,
  type ActionOutput,
  type ActionSubjectId,
} from "@continual/runtime"
import { describe, expect, expectTypeOf, it } from "vitest"

import { AcmeApi, QualifyLead } from "./index"

describe("Acme CRM contract", () => {
  it("publishes a serializable closed-world description", () => {
    const description = createApiDescription(AcmeApi)
    const crm = description.modules.find((module) => module.id === "crm")

    expect(description).toMatchObject({
      api: { id: "acme", name: "Acme" },
      version: "0.7",
    })
    expect(crm?.objects.map((object) => object.id)).toEqual([
      "company",
      "contact",
      "lead",
      "deal",
    ])
    expect(crm?.actions).toEqual([
      expect.objectContaining({
        errors: [],
        id: "qualifyLead",
        verb: "qualify",
        subjectId: "lead",
      }),
    ])
    expect(
      crm?.objects.find((object) => object.id === "company")?.display.image
    ).toBe("logo")
    expect(
      crm?.objects.find((object) => object.id === "contact")?.display.image
    ).toBe("photo")
    expect(
      crm?.objects.find((object) => object.id === "lead")?.operations
    ).toEqual({
      batchGet: true,
      create: true,
      get: true,
      list: true,
      update: true,
      delete: true,
    })
    expect(
      crm?.objects.find((object) => object.id === "lead")?.fields.email?.schema
    ).toMatchObject({ kind: "string", format: "email" })
    expect(
      crm?.objects.find((object) => object.id === "lead")?.fields.email
    ).toMatchObject({ defaultValue: "", nullable: false })
    expect(
      crm?.objects.find((object) => object.id === "company")?.fields.logo
    ).toMatchObject({ nullable: true })
    expect(
      crm?.objects.find((object) => object.id === "deal")?.fields
        .expectedCloseDate?.schema
    ).toMatchObject({ kind: "string", format: "date" })
    expect(() => JSON.stringify(description)).not.toThrow()
  })

  it("infers action input and output from Continual schemas", () => {
    type Input = ActionInput<typeof QualifyLead>
    type Error = ActionError<typeof QualifyLead>
    type Output = ActionOutput<typeof QualifyLead>
    type SubjectId = ActionSubjectId<typeof QualifyLead>

    expectTypeOf<Input>().toEqualTypeOf<{}>()
    expectTypeOf<Output>().toMatchTypeOf<{
      readonly leadId: string
      readonly companyId: string
      readonly contactId: string
    }>()
    expectTypeOf<Error>().toEqualTypeOf<never>()
    expectTypeOf(QualifyLead.verb).toEqualTypeOf<"qualify">()
    expectTypeOf<SubjectId>().toEqualTypeOf<
      string & { readonly _ObjectId: "lead" }
    >()
    expectTypeOf(
      AcmeApi.modules[0].objects[0].collection
    ).toEqualTypeOf<"companies">()
  })
})
