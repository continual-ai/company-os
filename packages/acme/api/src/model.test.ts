import {
  createApiDescription,
  type ActionError,
  type ActionInput,
  type ActionOutput,
  type RecordId,
} from "@continual/runtime"
import { describe, expect, expectTypeOf, it } from "vitest"

import { AcmeModel } from "./index"

const ContactPrimaryCompany = AcmeModel.links.contactPrimaryCompany
const QualifyLead = AcmeModel.actions.lead.qualify

describe("Acme model contract", () => {
  it("publishes a serializable closed-world description", () => {
    const description = createApiDescription(AcmeModel)

    expect(description).toMatchObject({
      api: { id: "acme", name: "Acme" },
      root: { id: "root", kind: "root", name: "Root" },
      version: "0.15",
    })
    expect(description.objects.map((object) => object.id)).toEqual([
      "company",
      "contact",
      "lead",
      "deal",
    ])
    expect(description.actions).toContainEqual(
      expect.objectContaining({
        id: "qualify",
        objectId: "lead",
        scope: "object",
        http: { method: "POST", path: "/leads/{id}:qualify" },
      })
    )
    expect(
      description.actions
        .filter((action) => action.objectId === "lead")
        .map((action) => action.id)
    ).toEqual(["create", "update", "delete", "qualify"])
    expect(description.links).toEqual([
      expect.objectContaining({
        id: "contactPrimaryCompany",
        from: {
          cardinality: "zeroOrOne",
          name: "primaryCompany",
          objectId: "contact",
          property: "primaryCompanyId",
        },
        to: { cardinality: "many", name: "contacts", objectId: "company" },
      }),
      expect.objectContaining({
        id: "dealCompany",
        from: {
          cardinality: "one",
          name: "company",
          objectId: "deal",
          property: "companyId",
        },
        to: { cardinality: "many", name: "deals", objectId: "company" },
      }),
    ])
    expect(
      description.objects.find((object) => object.id === "lead")?.properties
        .email
    ).toMatchObject({ kind: "string", format: "email", defaultValue: "" })
    expect(
      description.objects.find((object) => object.id === "company")?.properties
        .logo
    ).toMatchObject({ kind: "image", nullable: true })
    expect(description.objects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "company",
          parent: { kind: "root", objectId: "root" },
        }),
      ])
    )
    expect(() => JSON.stringify(description)).not.toThrow()
  })

  it("infers complete object-notation action inputs", () => {
    type Input = ActionInput<typeof QualifyLead>
    type Error = ActionError<typeof QualifyLead>
    type Output = ActionOutput<typeof QualifyLead>

    expectTypeOf<Input>().toEqualTypeOf<{
      readonly id: RecordId<"lead">
    }>()
    expectTypeOf<Output>().toEqualTypeOf<{
      readonly companyId: RecordId<"company">
      readonly contactId: RecordId<"contact">
    }>()
    expectTypeOf<Error>().toEqualTypeOf<never>()
    expectTypeOf(QualifyLead.id).toEqualTypeOf<"qualify">()
    expectTypeOf(
      AcmeModel.objects.company.collection
    ).toEqualTypeOf<"companies">()
    expectTypeOf(
      ContactPrimaryCompany.from.name
    ).toEqualTypeOf<"primaryCompany">()
    expectTypeOf(
      ContactPrimaryCompany.from.property
    ).toEqualTypeOf<"primaryCompanyId">()
    expectTypeOf(ContactPrimaryCompany.to.name).toEqualTypeOf<"contacts">()
  })
})
