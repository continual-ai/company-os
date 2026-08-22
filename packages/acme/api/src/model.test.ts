import {
  createApiDescription,
  type ModelObjectRef,
  type RecordId,
} from "@continual/runtime"
import { describe, expect, expectTypeOf, it } from "vitest"

import { AcmeModel } from "./index"

const ContactPrimaryCompany = AcmeModel.links.contactPrimaryCompany

describe("Acme model contract", () => {
  it("publishes a serializable closed-world description", () => {
    const description = createApiDescription(AcmeModel)

    expect(description).toMatchObject({
      api: { id: "acme", name: "Acme" },
      root: { id: "root", kind: "root", name: "Root" },
      version: "0.19",
    })
    expect(description.objects.map((object) => object.id)).toEqual([
      "company",
      "contact",
      "lead",
      "deal",
      "lineItem",
      "interaction",
    ])
    expect(description.interfaces).toEqual([
      expect.objectContaining({
        id: "party",
        display: { icon: "party", image: "image", title: "name" },
      }),
    ])
    expect(
      description.actions
        .filter((action) => action.objectType === "lead")
        .map((action) => action.id)
    ).toEqual(["create", "update", "delete", "batchDelete"])
    expect(description.links).toEqual([
      expect.objectContaining({
        id: "contactPrimaryCompany",
        from: expect.objectContaining({
          cardinality: "zeroOrOne",
          description: "The contact's primary company.",
          key: "primaryCompany",
          label: "Primary company",
          typeId: "contact",
        }),
        to: expect.objectContaining({
          cardinality: "many",
          key: "contacts",
          label: "Contacts",
          typeId: "company",
        }),
      }),
      expect.objectContaining({
        id: "dealCompany",
        from: expect.objectContaining({
          cardinality: "one",
          key: "company",
          label: "Company",
          typeId: "deal",
        }),
        to: expect.objectContaining({
          cardinality: "many",
          key: "deals",
          label: "Deals",
          typeId: "company",
        }),
      }),
      expect.objectContaining({
        id: "interactionSubject",
        from: expect.objectContaining({
          cardinality: "one",
          key: "subject",
          label: "Subject",
          typeId: "interaction",
        }),
        to: expect.objectContaining({
          cardinality: "many",
          description: "Interactions involving this party.",
          key: "interactions",
          label: "Interactions",
          typeId: "party",
        }),
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
    ).toMatchObject({ kind: "recordId", typeId: "party" })
    expect(description.objects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "company",
          parent: { objectType: "root" },
        }),
        expect.objectContaining({
          id: "lineItem",
          parent: { objectType: "deal" },
        }),
      ])
    )
    expect(() => JSON.stringify(description)).not.toThrow()
  })

  it("preserves model and link literal types", () => {
    expectTypeOf(
      AcmeModel.objects.company.collection
    ).toEqualTypeOf<"companies">()
    expectTypeOf(
      ContactPrimaryCompany.from.key
    ).toEqualTypeOf<"primaryCompany">()
    expectTypeOf(ContactPrimaryCompany.to.key).toEqualTypeOf<"contacts">()
    expectTypeOf(
      AcmeModel.objects.contact.properties.primaryCompanyId.typeId
    ).toEqualTypeOf<"company">()
    expectTypeOf(
      AcmeModel.objects.deal.properties.companyId.typeId
    ).toEqualTypeOf<"company">()
  })

  it("keeps heterogeneous object references discriminated", () => {
    type Ref = ModelObjectRef<typeof AcmeModel>
    type CompanyRef = Extract<Ref, { readonly objectType: "company" }>
    type ContactRef = Extract<Ref, { readonly objectType: "contact" }>

    expectTypeOf<CompanyRef["id"]>().toEqualTypeOf<RecordId<"company">>()
    expectTypeOf<ContactRef["id"]>().toEqualTypeOf<RecordId<"contact">>()
  })
})
