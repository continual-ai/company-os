import { describe, expect, expectTypeOf, it } from "vitest"

import { appMetadata } from "#/app.config.ts"
import { type ActorId, type IdentityId } from "#/app.model.ts"
import { Model } from "#/app.model.ts"
import {
  describeModel,
  type ModelObjectCreateInput,
  type ModelObjectRef,
  type ObjectRecord,
  type QueryInput,
  type QueryOutput,
  type RecordAlias,
  type RecordId,
  type RecordIdOf,
} from "#/runtime/model/index.ts"

const ContactPrimaryCompany = Model.links.contactPrimaryCompany

describe("model contract", () => {
  it("publishes a serializable closed-world description", () => {
    const description = describeModel(Model)

    expect(description).toMatchObject({
      actor: { typeId: "actor" },
      model: { name: appMetadata.name },
      root: { id: "root", kind: "root", name: "Root" },
      version: "0.30",
    })
    expect(description.queries).toContainEqual(
      expect.objectContaining({
        id: "pipelineSummary",
        kind: "query",
        objectType: "deal",
        scope: "collection",
        input: expect.objectContaining({ kind: "struct" }),
        output: expect.objectContaining({ kind: "struct" }),
      })
    )
    expect(description.relationships).toContainEqual(
      expect.objectContaining({
        id: "contactPrimaryCompany",
        forward: expect.objectContaining({
          key: "primaryCompany",
          cardinality: "zeroOrOne",
        }),
        reverse: expect.objectContaining({
          key: "primaryContacts",
          cardinality: "many",
        }),
        storage: {
          kind: "link",
          linkId: "contactPrimaryCompany",
          subsetOf: "contactCompanies",
        },
      })
    )
    expect(description.relationships).toContainEqual(
      expect.objectContaining({
        id: "lead.convertedCompany",
        reverse: expect.objectContaining({
          key: "convertedLeads",
          label: "Converted leads",
        }),
        storage: {
          kind: "reference",
          objectType: "lead",
          property: "convertedCompany",
          onDelete: "restrict",
        },
      })
    )
    expectTypeOf<
      QueryInput<typeof Model.objects.deal, "pipelineSummary">
    >().toEqualTypeOf<{}>()
    expectTypeOf<
      QueryOutput<
        typeof Model.objects.deal,
        "pipelineSummary"
      >["groups"][number]["count"]
    >().toEqualTypeOf<number>()
    expect(description.modules.map((module) => module.id)).toEqual(
      Object.keys(Model.modules)
    )
    expect(description.modules.map((module) => module.id)).toEqual(
      expect.arrayContaining(["platform", "notes", "sales"])
    )
    expect(
      description.modules.flatMap((module) => module.objectIds).sort()
    ).toEqual(description.objects.map((object) => object.id).sort())
    expect(description.interfaces.map((item) => item.id)).toEqual(
      Object.keys(Model.interfaces)
    )
    expect(description.interfaces.map((item) => item.id)).toEqual(
      expect.arrayContaining(["actor", "identity", "noteSubject", "party"])
    )
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
    expect(description.links.map((link) => link.id)).toEqual(
      Object.keys(Model.links)
    )
    expect(description.links.map((link) => link.id)).toEqual(
      expect.arrayContaining([
        "noteSubjects",
        "contactCompanies",
        "contactPrimaryCompany",
        "dealCompanies",
      ])
    )
    expect(description.links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "contactPrimaryCompany",
          forward: expect.objectContaining({
            cardinality: "zeroOrOne",
            description: "The company this person mainly works with.",
            from: { kind: "object", typeId: "contact" },
            key: "primaryCompany",
            label: "Primary company",
            to: { kind: "object", typeId: "company" },
          }),
          reverse: expect.objectContaining({
            cardinality: "many",
            from: { kind: "object", typeId: "company" },
            key: "primaryContacts",
            label: "Primary contacts",
            to: { kind: "object", typeId: "contact" },
          }),
        }),
        expect.objectContaining({
          id: "noteSubjects",
          forward: expect.objectContaining({
            cardinality: "many",
            description:
              "Link the people, companies, or work this note is about.",
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
          parent: { kind: "root", typeId: "root" },
        }),
        expect.objectContaining({
          id: "lineItem",
          parent: { kind: "object", typeId: "deal" },
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
    expectTypeOf(
      ContactPrimaryCompany.reverse.key
    ).toEqualTypeOf<"primaryContacts">()
    expect(Model.objects.contact.properties).not.toHaveProperty(
      "primaryCompany"
    )
    expectTypeOf(Model.objects.deal.parent.typeId).toEqualTypeOf<"root">()
    // Note subjects are exactly the NoteSubject implementers, whichever modules supply them.
    type NoteSubjectId = RecordIdOf<
      typeof Model,
      (typeof Model.interfaces)["noteSubject"]
    >
    expectTypeOf<
      NonNullable<
        NonNullable<
          ModelObjectCreateInput<
            typeof Model,
            typeof Model.objects.note
          >["links"]
        >["subjects"]
      >[number]
    >().toEqualTypeOf<RecordAlias | NoteSubjectId>()
    expectTypeOf<
      RecordId<"company"> | RecordId<"contact"> | RecordId<"lead">
    >().toExtend<NoteSubjectId>()
    expectTypeOf<RecordId<"user">>().not.toExtend<NoteSubjectId>()
    expectTypeOf<RecordId<"role">>().not.toExtend<NoteSubjectId>()
    expectTypeOf<"contacts" | "primaryContacts" | "notes">().toExtend<
      keyof NonNullable<
        ModelObjectCreateInput<
          typeof Model,
          typeof Model.objects.company
        >["links"]
      >
    >()
    expectTypeOf<
      RecordIdOf<typeof Model, (typeof Model.interfaces)["party"]>
    >().toEqualTypeOf<RecordId<"company"> | RecordId<"contact">>()
    expectTypeOf<IdentityId>().toEqualTypeOf<
      RecordId<"serviceAccount"> | RecordId<"user">
    >()
    expectTypeOf<ActorId>().toEqualTypeOf<
      RecordId<"anonymousActor"> | RecordId<"serviceAccount"> | RecordId<"user">
    >()
    expectTypeOf<
      ObjectRecord<typeof Model.objects.company>["createdBy"]
    >().toEqualTypeOf<ActorId>()
  })

  it("keeps heterogeneous object references discriminated", () => {
    type Ref = ModelObjectRef<typeof Model>
    type CompanyRef = Extract<Ref, { readonly objectType: "company" }>
    type ContactRef = Extract<Ref, { readonly objectType: "contact" }>

    expectTypeOf<CompanyRef["id"]>().toEqualTypeOf<RecordId<"company">>()
    expectTypeOf<ContactRef["id"]>().toEqualTypeOf<RecordId<"contact">>()
  })
})
