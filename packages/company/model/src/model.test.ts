import {
  createApiDescription,
  type InferSchema,
  type ModelObjectRef,
  type ObjectCreateInput,
  type ObjectRecord,
  type RecordAlias,
  type RecordId,
  type RecordIdOf,
} from "@company/runtime"
import { describe, expect, expectTypeOf, it } from "vitest"

import { Model, type ActorId, type IdentityId, type PrincipalId } from "./index"
import { modelMetadata } from "./metadata"

const ContactPrimaryCompany = Model.links.contactPrimaryCompany

describe("model contract", () => {
  it("publishes a serializable closed-world description", () => {
    const description = createApiDescription(Model)

    expect(description).toMatchObject({
      actor: { typeId: "actor" },
      api: { id: "operatingSystem", name: modelMetadata.name },
      root: { id: "platform", kind: "root", name: "Platform" },
      version: "0.26",
    })
    expect(description.objects.map((object) => object.id)).toEqual([
      "user",
      "serviceAccount",
      "anonymousActor",
      "apiKey",
      "group",
      "principalSet",
      "groupMembership",
      "role",
      "roleAssignment",
      "invitation",
      "company",
      "contact",
      "lead",
      "deal",
      "lineItem",
      "interaction",
    ])
    expect(description.interfaces.map((item) => item.id)).toEqual([
      "actor",
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
    ).toEqual(["create", "update", "delete", "batchDelete", "convert"])
    expect(Model.actions.invitation.accept.id).toBe("accept")
    expect(description.links.map((link) => link.id)).toEqual([
      "groupMembershipMember",
      "roleAssignmentPrincipal",
      "roleAssignmentRole",
      "invitationRole",
      "invitationAcceptedBy",
      "contactPrimaryCompany",
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
          id: "deal",
          parent: { kind: "object", typeId: "company" },
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
    expect(Model.actor.id).toBe("actor")
    expectTypeOf(Model.objects.company.collection).toEqualTypeOf<"companies">()
    expectTypeOf(
      ContactPrimaryCompany.forward.key
    ).toEqualTypeOf<"primaryCompany">()
    expectTypeOf(ContactPrimaryCompany.reverse.key).toEqualTypeOf<"contacts">()
    expectTypeOf(
      Model.objects.contact.properties.primaryCompany.typeId
    ).toEqualTypeOf<"company">()
    expectTypeOf(Model.objects.deal.parent.typeId).toEqualTypeOf<"company">()
    expectTypeOf<
      InferSchema<typeof Model.objects.interaction.properties.subject>
    >().toEqualTypeOf<RecordId<"company"> | RecordId<"contact">>()
    expectTypeOf<
      RecordIdOf<typeof Model, (typeof Model.interfaces)["party"]>
    >().toEqualTypeOf<RecordId<"company"> | RecordId<"contact">>()
    expectTypeOf<IdentityId>().toEqualTypeOf<
      RecordId<"serviceAccount"> | RecordId<"user">
    >()
    expectTypeOf<ActorId>().toEqualTypeOf<
      RecordId<"anonymousActor"> | RecordId<"serviceAccount"> | RecordId<"user">
    >()
    expectTypeOf<PrincipalId>().toEqualTypeOf<
      | RecordId<"group">
      | RecordId<"principalSet">
      | RecordId<"serviceAccount">
      | RecordId<"user">
    >()
    expectTypeOf<
      ObjectRecord<typeof Model.objects.company>["createdBy"]
    >().toEqualTypeOf<ActorId>()
    expectTypeOf<
      ObjectCreateInput<typeof Model.objects.roleAssignment>["parent"]
    >().toEqualTypeOf<
      RecordAlias | RecordId<"company"> | RecordId<"platform">
    >()
    expectTypeOf<
      ObjectCreateInput<typeof Model.objects.roleAssignment>["principal"]
    >().toEqualTypeOf<
      | RecordAlias
      | RecordId<"group">
      | RecordId<"principalSet">
      | RecordId<"serviceAccount">
      | RecordId<"user">
    >()
    expectTypeOf<
      ObjectRecord<typeof Model.objects.roleAssignment>["role"]
    >().toEqualTypeOf<RecordId<"role">>()
  })

  it("keeps heterogeneous object references discriminated", () => {
    type Ref = ModelObjectRef<typeof Model>
    type CompanyRef = Extract<Ref, { readonly objectType: "company" }>
    type ContactRef = Extract<Ref, { readonly objectType: "contact" }>

    expectTypeOf<CompanyRef["id"]>().toEqualTypeOf<RecordId<"company">>()
    expectTypeOf<ContactRef["id"]>().toEqualTypeOf<RecordId<"contact">>()
  })
})
