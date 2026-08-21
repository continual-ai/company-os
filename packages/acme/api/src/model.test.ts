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
      version: "0.16",
    })
    expect(description.objects.map((object) => object.id)).toEqual([
      "company",
      "contact",
      "lead",
      "deal",
      "interaction",
    ])
    expect(description.interfaces).toEqual([
      expect.objectContaining({
        id: "party",
        display: { icon: "party", image: "image", title: "name" },
      }),
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
          typeId: "contact",
        },
        to: { cardinality: "many", name: "contacts", typeId: "company" },
      }),
      expect.objectContaining({
        id: "dealCompany",
        from: {
          cardinality: "one",
          name: "company",
          typeId: "deal",
        },
        to: { cardinality: "many", name: "deals", typeId: "company" },
      }),
      expect.objectContaining({
        id: "interactionSubject",
        from: {
          cardinality: "one",
          name: "subject",
          typeId: "interaction",
        },
        to: {
          cardinality: "many",
          name: "interactions",
          typeId: "party",
        },
      }),
    ])
    expect(
      description.objects.find((object) => object.id === "lead")?.properties
        .email
    ).toMatchObject({
      kind: "string",
      format: "email",
      nullable: true,
      requiredOnCreate: false,
    })
    expect(
      description.objects.find((object) => object.id === "company")?.properties
        .name
    ).toMatchObject({ requiredOnCreate: true })
    expect(
      description.objects.find((object) => object.id === "company")?.properties
        .logo
    ).toMatchObject({ kind: "image", nullable: true })
    expect(
      description.objects.find((object) => object.id === "company")?.interfaces
    ).toEqual({
      party: {
        interfaceId: "party",
        properties: { image: "logo", name: "name" },
      },
    })
    expect(
      description.objects.find((object) => object.id === "interaction")
        ?.properties.subjectId
    ).toMatchObject({ kind: "recordId", objectId: "party" })
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
    expectTypeOf(ContactPrimaryCompany.to.name).toEqualTypeOf<"contacts">()
  })
})
