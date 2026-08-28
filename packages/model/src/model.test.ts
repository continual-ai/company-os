import {
  describeModel,
  type ModelObjectCreateInput,
  type ModelObjectRef,
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
    const description = describeModel(Model)

    expect(description).toMatchObject({
      actor: { typeId: "actor" },
      model: { name: modelMetadata.name },
      root: { id: "root", kind: "root", name: "Root" },
      version: "0.30",
    })
    expect(description.modules).toEqual([
      {
        id: "access",
        interfaceIds: ["actor", "authorizationScope", "identity", "principal"],
        linkIds: [],
        name: "Access",
        objectIds: [
          "user",
          "serviceAccount",
          "anonymousActor",
          "group",
          "principalSet",
          "groupMembership",
          "role",
          "roleAssignment",
        ],
      },
      {
        id: "sales",
        interfaceIds: ["party", "noteSubject"],
        linkIds: ["contactPrimaryCompany", "noteSubjects"],
        name: "Sales",
        objectIds: ["company", "contact", "lead", "deal", "lineItem", "note"],
      },
    ])
    expect(description.objects.map((object) => object.id)).toEqual([
      "user",
      "serviceAccount",
      "anonymousActor",
      "group",
      "principalSet",
      "groupMembership",
      "role",
      "roleAssignment",
      "company",
      "contact",
      "lead",
      "deal",
      "lineItem",
      "note",
    ])
    expect(description.interfaces.map((item) => item.id)).toEqual([
      "actor",
      "authorizationScope",
      "identity",
      "principal",
      "party",
      "noteSubject",
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
    expect(
      description.queries
        .filter((query) => query.objectType === "lead")
        .map((query) => query.id)
    ).toEqual(["get", "list", "batchGet"])
    expect(description.links.map((link) => link.id)).toEqual([
      "contactPrimaryCompany",
      "noteSubjects",
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
          id: "noteSubjects",
          forward: expect.objectContaining({
            cardinality: "many",
            description: "The business records this note concerns.",
            from: { kind: "object", typeId: "note" },
            key: "subjects",
            label: "Subjects",
            to: { kind: "interface", typeId: "noteSubject" },
          }),
          reverse: expect.objectContaining({
            cardinality: "many",
            description: "Notes attached to this business record.",
            from: { kind: "interface", typeId: "noteSubject" },
            key: "notes",
            label: "Notes",
            to: { kind: "object", typeId: "note" },
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
      noteSubject: {
        interfaceId: "noteSubject",
        propertyMapping: {},
      },
    })
    const note = description.objects.find((object) => object.id === "note")
    expect(note?.properties).toEqual(
      expect.objectContaining({ content: expect.any(Object) })
    )
    expect(note?.properties).not.toHaveProperty("subject")
    expect(note?.properties).not.toHaveProperty("subjectId")
    expect(description.objects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "company",
          parent: { kind: "root", typeId: "root" },
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
    expect(Model.objects.contact.properties).not.toHaveProperty(
      "primaryCompany"
    )
    expectTypeOf(Model.objects.deal.parent.typeId).toEqualTypeOf<"company">()
    expectTypeOf<
      NonNullable<
        ModelObjectCreateInput<typeof Model, typeof Model.objects.note>["links"]
      >["subjects"]
    >().toEqualTypeOf<
      | ReadonlyArray<
          | RecordAlias
          | RecordId<"company">
          | RecordId<"contact">
          | RecordId<"deal">
          | RecordId<"lead">
        >
      | undefined
    >()
    expectTypeOf<
      keyof NonNullable<
        ModelObjectCreateInput<
          typeof Model,
          typeof Model.objects.company
        >["links"]
      >
    >().toEqualTypeOf<"contacts">()
    expectTypeOf<
      RecordIdOf<typeof Model, (typeof Model.interfaces)["party"]>
    >().toEqualTypeOf<RecordId<"company"> | RecordId<"contact">>()
    expectTypeOf<
      RecordIdOf<typeof Model, (typeof Model.interfaces)["noteSubject"]>
    >().toEqualTypeOf<
      | RecordId<"company">
      | RecordId<"contact">
      | RecordId<"deal">
      | RecordId<"lead">
    >()
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
      ModelObjectCreateInput<
        typeof Model,
        typeof Model.objects.roleAssignment
      >["parent"]
    >().toEqualTypeOf<RecordAlias | RecordId<"company"> | RecordId<"root">>()
    expectTypeOf<
      ModelObjectCreateInput<
        typeof Model,
        typeof Model.objects.roleAssignment
      >["principal"]
    >().toEqualTypeOf<
      | RecordAlias
      | RecordId<"group">
      | RecordId<"principalSet">
      | RecordId<"serviceAccount">
      | RecordId<"user">
    >()
    expectTypeOf<
      ModelObjectCreateInput<
        typeof Model,
        typeof Model.objects.roleAssignment
      >["role"]
    >().toEqualTypeOf<RecordAlias | RecordId<"role">>()
  })

  it("keeps heterogeneous object references discriminated", () => {
    type Ref = ModelObjectRef<typeof Model>
    type CompanyRef = Extract<Ref, { readonly objectType: "company" }>
    type ContactRef = Extract<Ref, { readonly objectType: "contact" }>

    expectTypeOf<CompanyRef["id"]>().toEqualTypeOf<RecordId<"company">>()
    expectTypeOf<ContactRef["id"]>().toEqualTypeOf<RecordId<"contact">>()
  })
})
