import { describe, expect, expectTypeOf, it } from "vitest"

import { appMetadata } from "#/app.config.ts"
import { Model, type ActorId, type IdentityId } from "#/app.model.ts"
import { type ModelObjectCreateInput } from "#/runtime/model/definition/model-input.ts"
import {
  describeModel,
  type ModelObjectRef,
  type ObjectRecord,
  type QueryInput,
  type QueryOutput,
  type RecordAlias,
  type RecordId,
  type RecordIdOf,
} from "#/runtime/model/index.ts"

const ActivityAccounts = Model.links.activityAccounts

describe("model contract", () => {
  it("publishes a serializable closed-world description", () => {
    const description = describeModel(Model)

    expect(description).toMatchObject({
      actor: { typeId: "actor" },
      model: { name: appMetadata.name },
      version: "0.36",
    })
    expect(description).not.toHaveProperty("root")
    expect(description.queries).toContainEqual(
      expect.objectContaining({
        id: "pipelineSummary",
        kind: "query",
        objectType: "opportunity",
        scope: "object",
        input: expect.objectContaining({ kind: "struct" }),
        output: expect.objectContaining({ kind: "struct" }),
      })
    )
    expect(description.links).toContainEqual(
      expect.objectContaining({
        id: "activityAccounts",
        forward: expect.objectContaining({
          key: "accounts",
          min: 0,
        }),
        reverse: expect.objectContaining({
          key: "activities",
          min: 0,
        }),
      })
    )
    expect(description.links).toContainEqual(
      expect.objectContaining({
        id: "leadOpportunity",
        reverse: expect.objectContaining({
          key: "sourceLead",
          label: "Source lead",
        }),
        outputOnly: true,
      })
    )
    expectTypeOf<
      QueryInput<(typeof Model.queries)["opportunity.pipelineSummary"]>
    >().toEqualTypeOf<{}>()
    expectTypeOf<
      QueryOutput<
        (typeof Model.queries)["opportunity.pipelineSummary"]
      >["groups"][number]["count"]
    >().toEqualTypeOf<number>()
    expect(description.modules.map((module) => module.id)).toEqual(
      Object.keys(Model.modules)
    )
    expect(description.modules.map((module) => module.id)).toEqual(
      expect.arrayContaining(["platform", "sales"])
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
        "activityAccounts",
        "opportunityAccounts",
      ])
    )
    expect(description.links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "activityAccounts",
          forward: expect.objectContaining({
            min: 0,

            from: { kind: "object", typeId: "activity" },
            key: "accounts",
            label: "Accounts",
            to: { kind: "object", typeId: "account" },
          }),
          reverse: expect.objectContaining({
            min: 0,
            from: { kind: "object", typeId: "account" },
            key: "activities",
            label: "Activities",
            to: { kind: "object", typeId: "activity" },
          }),
        }),
        expect.objectContaining({
          id: "noteSubjects",
          forward: expect.objectContaining({
            min: 0,
            description:
              "Link the people, accounts, or work this note is about.",
            from: { kind: "object", typeId: "note" },
            key: "subjects",
            label: "Subjects",
            to: { kind: "interface", typeId: "noteSubject" },
          }),
          reverse: expect.objectContaining({
            min: 0,
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
      description.objects.find((object) => object.id === "contact")?.properties
        .email
    ).toMatchObject({
      kind: "string",
      format: "email",
      nullable: true,
      requiredOnCreate: false,
    })
    expect(
      description.objects.find((object) => object.id === "account")?.properties
        .name
    ).toMatchObject({ requiredOnCreate: true })
    expect(
      description.objects.find((object) => object.id === "account")?.properties
        .logo
    ).toMatchObject({ kind: "image", nullable: true })
    expect(
      description.objects.find((object) => object.id === "account")?.interfaces
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
          id: "account",
        }),
        expect.objectContaining({
          id: "opportunity",
        }),
        expect.objectContaining({
          id: "lineItem",
        }),
      ])
    )
    expect(() => JSON.stringify(description)).not.toThrow()
  })

  it("preserves model and link literal types", () => {
    expect(Model.actor.id).toBe("actor")
    expectTypeOf(Model.objects.account.collection).toEqualTypeOf<"accounts">()
    expectTypeOf(ActivityAccounts.forward.key).toEqualTypeOf<"accounts">()
    expectTypeOf(ActivityAccounts.reverse.key).toEqualTypeOf<"activities">()
    expect(Model.objects.contact.properties).not.toHaveProperty("accounts")
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
      RecordId<"account"> | RecordId<"contact"> | RecordId<"lead">
    >().toExtend<NoteSubjectId>()
    expectTypeOf<RecordId<"user">>().not.toExtend<NoteSubjectId>()
    expectTypeOf<RecordId<"role">>().not.toExtend<NoteSubjectId>()
    expectTypeOf<"affiliations" | "notes">().toExtend<
      keyof NonNullable<
        ModelObjectCreateInput<
          typeof Model,
          typeof Model.objects.account
        >["links"]
      >
    >()
    expectTypeOf<
      RecordIdOf<typeof Model, (typeof Model.interfaces)["party"]>
    >().toEqualTypeOf<RecordId<"account"> | RecordId<"contact">>()
    expectTypeOf<IdentityId>().toEqualTypeOf<
      RecordId<"serviceAccount"> | RecordId<"user">
    >()
    expectTypeOf<ActorId>().toEqualTypeOf<
      RecordId<"anonymousActor"> | RecordId<"serviceAccount"> | RecordId<"user">
    >()
    expectTypeOf<
      ObjectRecord<typeof Model.objects.account>["createdBy"]
    >().toEqualTypeOf<ActorId>()
  })

  it("keeps heterogeneous object references discriminated", () => {
    type Ref = ModelObjectRef<typeof Model>
    type AccountRef = Extract<Ref, { readonly objectType: "account" }>
    type ContactRef = Extract<Ref, { readonly objectType: "contact" }>

    expectTypeOf<AccountRef["id"]>().toEqualTypeOf<RecordId<"account">>()
    expectTypeOf<ContactRef["id"]>().toEqualTypeOf<RecordId<"contact">>()
  })
})
