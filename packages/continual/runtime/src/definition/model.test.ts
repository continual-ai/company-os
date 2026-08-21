import { describe, expect, expectTypeOf, it } from "vitest"

import { defineError } from "./error"
import { defineInterface } from "./interface"
import { defineLink } from "./link"
import { defineModel } from "./model"
import { defineObject } from "./object"
import { Root } from "./root"
import { schema, type AnySchema } from "./schema"

const EnrollmentFailed = defineError({
  code: "enrollmentFailed",
  category: "failedPrecondition",
  name: "Enrollment failed",
  details: schema.object({ reason: schema.string() }),
})

const Contact = defineObject({
  id: "contact",
  collection: "contacts",
  name: "Contact",
  parent: Root,
  pluralName: "Contacts",
  properties: {
    name: schema.string(),
  },
  display: { title: "name" },
  actions: {
    enroll: {
      scope: "object",
      name: "Enroll contact",
      description: "Enrolls a contact in the customer program.",
      input: { notify: schema.optional(schema.boolean()) },
      output: { enrolled: schema.boolean() },
      errors: [EnrollmentFailed],
      http: { path: "/contacts/{id}:enroll" },
    },
  },
})

function invalidProperty(property: AnySchema) {
  return () =>
    defineObject({
      id: "example",
      collection: "examples",
      name: "Example",
      parent: Root,
      pluralName: "Examples",
      properties: { value: property },
      display: { title: "value" },
    })
}

function objectWithAction(path: `/${string}`, scope: "collection" | "object") {
  return () =>
    defineObject({
      id: "contact",
      collection: "contacts",
      name: "Contact",
      parent: Root,
      pluralName: "Contacts",
      properties: { name: schema.string() },
      display: { title: "name" },
      actions: {
        enroll: {
          scope,
          name: "Enroll contact",
          description: "Enrolls contacts.",
          output: { enrolled: schema.boolean() },
          http: { path },
        },
      },
    })
}

describe("model definitions", () => {
  it("indexes objects and their first-class actions", () => {
    const model = defineModel({
      id: "acme",
      name: "Acme",
      objects: [Contact],
      links: [],
    })

    expect(Object.keys(model.objects)).toEqual(["contact"])
    expect(model.root).toEqual(Root)
    expect(model.objects.contact.parent).toEqual({
      kind: "root",
      objectId: "root",
    })
    expect(Object.keys(model.actions.contact)).toEqual([
      "create",
      "update",
      "delete",
      "enroll",
    ])
    expect(model.actions.contact.enroll).toMatchObject({
      id: "enroll",
      objectId: "contact",
      scope: "object",
      http: { method: "POST", path: "/contacts/{id}:enroll" },
    })
    expect(model.actions.contact.enroll.input.properties).toHaveProperty("id")
    expect(model.actions.contact.create).toMatchObject({
      http: { method: "POST", path: "/contacts" },
      input: {
        properties: {
          name: { kind: "string", requiredOnCreate: true },
        },
      },
      output: { properties: { id: { kind: "recordId" } } },
    })
    expect(model.actions.contact.update).toMatchObject({
      http: { method: "PATCH", path: "/contacts/{id}" },
      input: { properties: { name: { kind: "optional" } } },
    })
    expect(model.actions.contact.delete.http).toEqual({
      method: "DELETE",
      path: "/contacts/{id}",
    })
    expectTypeOf(model.objects.contact.collection).toEqualTypeOf<"contacts">()
    expectTypeOf(model.objects.contact.parent.objectId).toEqualTypeOf<"root">()
    expectTypeOf(model.actions.contact.enroll.id).toEqualTypeOf<"enroll">()
  })

  it("rejects duplicate object identities and collections", () => {
    const OtherContact = defineObject({
      id: "contact",
      collection: "otherContacts",
      name: "Other contact",
      parent: Root,
      pluralName: "Other contacts",
      properties: { name: schema.string() },
      display: { title: "name" },
    })
    expect(() =>
      defineModel({
        id: "acme",
        name: "Acme",
        objects: [Contact, OtherContact],
        links: [],
      })
    ).toThrow(/Object id 'contact'/)

    const SameCollection = defineObject({
      id: "person",
      collection: "contacts",
      name: "Person",
      parent: Root,
      pluralName: "People",
      properties: { name: schema.string() },
      display: { title: "name" },
    })
    expect(() =>
      defineModel({
        id: "acme",
        name: "Acme",
        objects: [Contact, SameCollection],
        links: [],
      })
    ).toThrow(/collection 'contacts'/)
  })

  it("rejects object references absent from the model", () => {
    const Account = defineObject({
      id: "account",
      collection: "accounts",
      name: "Account",
      parent: Root,
      pluralName: "Accounts",
      properties: { name: schema.string() },
      display: { title: "name" },
    })
    const Membership = defineObject({
      id: "membership",
      collection: "memberships",
      name: "Membership",
      parent: Account,
      pluralName: "Memberships",
      properties: {
        accountId: schema.recordId(Account),
      },
      display: { title: "accountId" },
    })

    expectTypeOf(Membership.parent.objectId).toEqualTypeOf<"account">()
    const completeModel = defineModel({
      id: "complete",
      name: "Complete",
      objects: [Account, Membership],
      links: [],
    })
    expect(completeModel.actions.membership.create.input).toMatchObject({
      properties: {
        parentId: { kind: "recordId", objectId: "account" },
      },
    })

    expect(() =>
      defineModel({
        id: "acme",
        name: "Acme",
        objects: [Membership],
        links: [],
      })
    ).toThrow(/parent references object 'account'/)
  })

  it("registers first-class bidirectional links", () => {
    const Company = defineObject({
      id: "company",
      collection: "companies",
      name: "Company",
      parent: Root,
      pluralName: "Companies",
      properties: { name: schema.string() },
      display: { title: "name" },
    })
    const CompanyContact = defineObject({
      id: "companyContact",
      collection: "companyContacts",
      name: "Company contact",
      parent: Root,
      pluralName: "Company contacts",
      properties: {
        companyId: schema.recordId(Company),
      },
      display: { title: "companyId" },
    })
    const Contacts = defineLink({
      id: "companyContacts",
      name: "Company contacts",
      from: {
        type: CompanyContact,
        name: "company",
        cardinality: "one",
      },
      to: { type: Company, name: "contacts", cardinality: "many" },
    })

    const model = defineModel({
      id: "acme",
      name: "Acme",
      objects: [Company, CompanyContact],
      links: [Contacts],
    })

    expect(model.links.companyContacts.from).toEqual({
      cardinality: "one",
      name: "company",
      typeId: "companyContact",
    })
    expectTypeOf(
      model.links.companyContacts.to.name
    ).toEqualTypeOf<"contacts">()
  })

  it("registers portable interfaces and validates exact object mappings", () => {
    const Party = defineInterface({
      id: "party",
      name: "Party",
      pluralName: "Parties",
      properties: {
        image: schema.image({ nullable: true }),
        name: schema.string(),
      },
      display: { icon: "party", image: "image", title: "name" },
    })
    const Company = defineObject({
      id: "company",
      collection: "companies",
      name: "Company",
      parent: Root,
      pluralName: "Companies",
      properties: {
        logo: schema.image({ nullable: true }),
        legalName: schema.string(),
      },
      display: { icon: "building", image: "logo", title: "legalName" },
      implements: [
        {
          interface: Party,
          properties: { image: "logo", name: "legalName" },
        },
      ],
    })

    const model = defineModel({
      id: "acme",
      name: "Acme",
      interfaces: [Party],
      objects: [Company],
      links: [],
    })

    expect(model.interfaces.party.display.icon).toBe("party")
    expect(model.objects.company.interfaces.party).toEqual({
      interfaceId: "party",
      properties: { image: "logo", name: "legalName" },
    })
    expectTypeOf(
      model.objects.company.interfaces.party.interfaceId
    ).toEqualTypeOf<"party">()

    expect(() =>
      defineObject({
        id: "person",
        collection: "people",
        name: "Person",
        parent: Root,
        pluralName: "People",
        properties: { name: schema.string() },
        display: { title: "name" },
        implements: [
          {
            interface: Party,
            properties: { name: "name" },
          },
        ],
      })
    ).toThrow(/must map exactly/)

    expect(() =>
      defineObject({
        id: "duplicateParty",
        collection: "duplicateParties",
        name: "Duplicate party",
        parent: Root,
        pluralName: "Duplicate parties",
        properties: {
          image: schema.image({ nullable: true }),
          name: schema.string(),
        },
        display: { title: "name" },
        implements: [
          {
            interface: Party,
            properties: { image: "image", name: "name" },
          },
          {
            interface: Party,
            properties: { image: "image", name: "name" },
          },
        ],
      })
    ).toThrow(/implements interface 'party' more than once/)
  })
})

describe("object properties", () => {
  it("reserves Root as the one non-CRUD hierarchy root", () => {
    expect(() =>
      defineObject({
        id: "root",
        collection: "roots",
        name: "Another root",
        parent: Root,
        pluralName: "Other roots",
        properties: { name: schema.string() },
        display: { title: "name" },
      })
    ).toThrow(/reserved for the built-in Root/)
  })

  it("uses schemas directly and normalizes object lifecycle behavior", () => {
    const Example = defineObject({
      id: "example",
      collection: "examples",
      name: "Example",
      parent: Root,
      pluralName: "Examples",
      properties: {
        title: schema.string(),
        count: schema.number({ default: 0 }),
        dueOn: schema.date({ nullable: true }),
        note: schema.string({ default: "", nullable: true }),
      },
      display: { title: "title" },
    })

    expect(Example.properties.title).toMatchObject({
      kind: "string",
      nullable: false,
      requiredOnCreate: true,
    })
    expect(Example.properties.count).toMatchObject({
      default: 0,
      requiredOnCreate: false,
    })
    expect(Example.properties.dueOn).toMatchObject({
      nullable: true,
      requiredOnCreate: false,
    })
    expect(Example.properties.note).toMatchObject({
      default: "",
      nullable: true,
      requiredOnCreate: false,
    })
  })

  it("rejects contradictory property annotations", () => {
    expect(
      invalidProperty(schema.string({ default: "generated", outputOnly: true }))
    ).toThrow(/output-only property cannot declare an input default/)
  })
})

describe("action HTTP bindings", () => {
  it("requires paths to agree with the object collection and scope", () => {
    expect(objectWithAction("/people/{id}:enroll", "object")).toThrow(
      /must begin with '\/contacts'/
    )
    expect(objectWithAction("/contacts:enroll", "object")).toThrow(
      /contain '\{id\}' exactly once/
    )
    expect(objectWithAction("/contacts/{id}:enroll", "collection")).toThrow(
      /cannot contain '\{id\}'/
    )
  })
})
