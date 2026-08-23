import {
  createApiDescription,
  type InferSchema,
  type ModelInterfaceRecordId,
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
      root: { id: "platform", kind: "root", name: "Platform" },
      version: "0.22",
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
        forward: expect.objectContaining({
          cardinality: "zeroOrOne",
          description: "The contact's primary company.",
          from: { kind: "object", typeId: "contact" },
          key: "primaryCompany",
          label: "Primary company",
          to: { kind: "object", typeId: "company" },
        }),
        reverse: expect.objectContaining({
          cardinality: "many",
          from: { kind: "object", typeId: "company" },
          key: "contacts",
          label: "Contacts",
          to: { kind: "object", typeId: "contact" },
        }),
      }),
      expect.objectContaining({
        id: "dealCompany",
        forward: expect.objectContaining({
          cardinality: "one",
          from: { kind: "object", typeId: "deal" },
          key: "company",
          label: "Company",
          to: { kind: "object", typeId: "company" },
        }),
        reverse: expect.objectContaining({
          cardinality: "many",
          from: { kind: "object", typeId: "company" },
          key: "deals",
          label: "Deals",
          to: { kind: "object", typeId: "deal" },
        }),
      }),
      expect.objectContaining({
        id: "interactionSubject",
        forward: expect.objectContaining({
          cardinality: "one",
          from: { kind: "object", typeId: "interaction" },
          key: "subject",
          label: "Subject",
          to: { kind: "interface", typeId: "party" },
        }),
        reverse: expect.objectContaining({
          cardinality: "many",
          description: "Interactions involving this party.",
          from: { kind: "interface", typeId: "party" },
          key: "interactions",
          label: "Interactions",
          to: { kind: "object", typeId: "interaction" },
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
        propertyMapping: { image: "logo", name: "name" },
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
          parent: { objectType: "platform" },
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
      ContactPrimaryCompany.forward.key
    ).toEqualTypeOf<"primaryCompany">()
    expectTypeOf(ContactPrimaryCompany.reverse.key).toEqualTypeOf<"contacts">()
    expectTypeOf(
      AcmeModel.objects.contact.properties.primaryCompanyId.typeId
    ).toEqualTypeOf<"company">()
    expectTypeOf(
      AcmeModel.objects.deal.properties.companyId.typeId
    ).toEqualTypeOf<"company">()
    expectTypeOf<
      InferSchema<typeof AcmeModel.objects.interaction.properties.subjectId>
    >().toEqualTypeOf<RecordId<"company"> | RecordId<"contact">>()
    expectTypeOf<
      ModelInterfaceRecordId<typeof AcmeModel, "party">
    >().toEqualTypeOf<RecordId<"company"> | RecordId<"contact">>()
  })

  it("keeps heterogeneous object references discriminated", () => {
    type Ref = ModelObjectRef<typeof AcmeModel>
    type CompanyRef = Extract<Ref, { readonly objectType: "company" }>
    type ContactRef = Extract<Ref, { readonly objectType: "contact" }>

    expectTypeOf<CompanyRef["id"]>().toEqualTypeOf<RecordId<"company">>()
    expectTypeOf<ContactRef["id"]>().toEqualTypeOf<RecordId<"contact">>()
  })
})
