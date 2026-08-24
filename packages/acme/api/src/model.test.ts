import {
  createApiDescription,
  type InferSchema,
  type ModelInterfaceRecordId,
  type ModelObjectRef,
  type ObjectCreateInput,
  type ObjectRecord,
  type RecordAlias,
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
      version: "0.25",
    })
    expect(description.objects.map((object) => object.id)).toEqual([
      "user",
      "serviceAccount",
      "group",
      "groupMembership",
      "role",
      "roleAssignment",
      "company",
      "contact",
      "lead",
      "deal",
      "lineItem",
      "interaction",
    ])
    expect(description.interfaces.map((item) => item.id)).toEqual([
      "authorizationScope",
      "identity",
      "party",
      "principal",
    ])
    expect(description.interfaces).toContainEqual(
      expect.objectContaining({
        id: "party",
        display: { icon: "party", image: "image", title: "name" },
      })
    )
    expect(
      description.actions
        .filter((action) => action.objectType === "lead")
        .map((action) => action.id)
    ).toEqual(["create", "update", "delete", "batchDelete"])
    expect(description.links.map((link) => link.id)).toEqual([
      "groupMembershipMember",
      "roleAssignmentPrincipal",
      "roleAssignmentRole",
      "contactPrimaryCompany",
      "dealCompany",
      "interactionSubject",
    ])
    expect(description.links).toEqual(
      expect.arrayContaining([
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
    )
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
      authorizationScope: {
        interfaceId: "authorizationScope",
        propertyMapping: {},
      },
      party: {
        interfaceId: "party",
        propertyMapping: { image: "logo", name: "name" },
      },
    })
    expect(
      description.objects.find((object) => object.id === "interaction")
        ?.properties.subject
    ).toMatchObject({ kind: "recordId", typeId: "party" })
    expect(
      description.objects.find((object) => object.id === "interaction")
        ?.properties
    ).not.toHaveProperty("subjectId")
    expect(description.objects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "company",
          parent: { kind: "root", typeId: "platform" },
        }),
        expect.objectContaining({
          id: "lineItem",
          parent: { kind: "object", typeId: "deal" },
        }),
        expect.objectContaining({
          id: "roleAssignment",
          parent: { kind: "interface", typeId: "authorizationScope" },
        }),
      ])
    )
    expect(() => JSON.stringify(description)).not.toThrow()
  })

  it("preserves model and link literal types", () => {
    expect(AcmeModel.actor.id).toBe("identity")
    expectTypeOf(
      AcmeModel.objects.company.collection
    ).toEqualTypeOf<"companies">()
    expectTypeOf(
      ContactPrimaryCompany.forward.key
    ).toEqualTypeOf<"primaryCompany">()
    expectTypeOf(ContactPrimaryCompany.reverse.key).toEqualTypeOf<"contacts">()
    expectTypeOf(
      AcmeModel.objects.contact.properties.primaryCompany.typeId
    ).toEqualTypeOf<"company">()
    expectTypeOf(
      AcmeModel.objects.deal.properties.company.typeId
    ).toEqualTypeOf<"company">()
    expectTypeOf<
      InferSchema<typeof AcmeModel.objects.interaction.properties.subject>
    >().toEqualTypeOf<RecordId<"company"> | RecordId<"contact">>()
    expectTypeOf<
      ModelInterfaceRecordId<typeof AcmeModel, "party">
    >().toEqualTypeOf<RecordId<"company"> | RecordId<"contact">>()
    expectTypeOf<
      ObjectCreateInput<typeof AcmeModel.objects.roleAssignment>["parent"]
    >().toEqualTypeOf<
      RecordAlias | RecordId<"company"> | RecordId<"platform">
    >()
    expectTypeOf<
      ObjectCreateInput<typeof AcmeModel.objects.roleAssignment>["principal"]
    >().toEqualTypeOf<
      | RecordAlias
      | RecordId<"group">
      | RecordId<"serviceAccount">
      | RecordId<"user">
    >()
    expectTypeOf<
      ObjectRecord<typeof AcmeModel.objects.roleAssignment>["role"]
    >().toEqualTypeOf<RecordId<"role">>()
  })

  it("keeps heterogeneous object references discriminated", () => {
    type Ref = ModelObjectRef<typeof AcmeModel>
    type CompanyRef = Extract<Ref, { readonly objectType: "company" }>
    type ContactRef = Extract<Ref, { readonly objectType: "contact" }>

    expectTypeOf<CompanyRef["id"]>().toEqualTypeOf<RecordId<"company">>()
    expectTypeOf<ContactRef["id"]>().toEqualTypeOf<RecordId<"contact">>()
  })
})
