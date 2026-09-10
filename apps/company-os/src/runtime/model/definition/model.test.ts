import { describe, expect, expectTypeOf, it } from "vitest"

import { Root } from "#/runtime/model/core/root.ts"
import type {
  ActionInput,
  ActionOutput,
} from "#/runtime/model/definition/action.ts"
import { defineError } from "#/runtime/model/definition/error.ts"
import {
  defineInterface,
  type InterfaceType,
} from "#/runtime/model/definition/interface.ts"
import { defineLink, type LinkType } from "#/runtime/model/definition/link.ts"
import {
  defineModel,
  enableModules,
  modelObjectLinkTraversals,
  modelTypeAccepts,
} from "#/runtime/model/definition/model.ts"
import { defineModule } from "#/runtime/model/definition/module.ts"
import {
  defineObject,
  type ObjectParent,
  type ObjectRecord,
  type ObjectType,
} from "#/runtime/model/definition/object.ts"
import {
  type RecordId,
  type RecordIdentifier,
  schema,
} from "#/runtime/model/definition/schema.ts"

const TestActor = defineInterface({
  id: "testActor",
  name: "Test actor",
  pluralName: "Test actors",
})

const EnrollmentFailed = defineError({
  name: "Enrollment failed",
  reason: "ENROLLMENT_FAILED",
  status: "FAILED_PRECONDITION",
  details: schema.object({ reason: schema.string() }),
})

const Contact = defineObject({
  id: "contact",
  collection: "contacts",
  name: "Contact",
  pluralName: "Contacts",
  properties: {
    name: schema.string(),
  },
  uniqueBy: { name: ["name"] },
  display: { title: "name" },
  actions: {
    enroll: {
      scope: "object",
      name: "Enroll contact",
      description: "Enrolls a contact in the customer program.",
      input: { notify: schema.optional(schema.boolean()) },
      output: { enrolled: schema.boolean() },
      errors: [EnrollmentFailed],
    },
  },
})

function defineTestModel<
  const TObjects extends ReadonlyArray<ObjectType>,
  const TLinks extends ReadonlyArray<LinkType>,
  const TInterfaces extends ReadonlyArray<InterfaceType>,
>(definition: {
  interfaces: TInterfaces
  links: TLinks
  name: string
  objects: TObjects
}) {
  const testModule = defineModule({
    id: "test",
    interfaces: definition.interfaces,
    links: definition.links,
    name: "Test",
    objects: definition.objects,
  })
  return defineModel({ modules: [testModule], name: definition.name })
}

const WorkspaceMarker = defineInterface({
  id: "workspaceMarker",
  name: "Workspace",
  pluralName: "Workspaces",
})
describe("definition inference", () => {
  it("derives every typed member from the one definition without annotations", () => {
    expectTypeOf(Contact.id).toEqualTypeOf<"contact">()
    expectTypeOf(Contact.collection).toEqualTypeOf<"contacts">()
    expectTypeOf(Contact.display.title).toEqualTypeOf<"name">()
    expectTypeOf(Contact.parent).toEqualTypeOf<ObjectParent<"root", "root">>()
    expectTypeOf<ObjectRecord<typeof Contact>["name"]>().toEqualTypeOf<string>()
    expectTypeOf<ObjectRecord<typeof Contact>["parent"]>().toEqualTypeOf<
      RecordId<"root">
    >()
    expectTypeOf<keyof typeof Contact.actions>().toEqualTypeOf<
      "batchDelete" | "create" | "delete" | "enroll" | "update"
    >()
    expectTypeOf<keyof typeof Contact.queries>().toEqualTypeOf<never>()
    expectTypeOf(Contact.actions.enroll.scope).toEqualTypeOf<"object">()
    expectTypeOf<ActionInput<typeof Contact.actions.enroll>>().toEqualTypeOf<{
      readonly id: RecordIdentifier<"contact">
      readonly notify?: boolean
    }>()
    expectTypeOf<ActionOutput<typeof Contact.actions.enroll>>().toEqualTypeOf<{
      readonly enrolled: boolean
    }>()
    expectTypeOf(Contact.actions.enroll.errors).toEqualTypeOf<
      readonly [typeof EnrollmentFailed]
    >()
    expectTypeOf(Contact).toExtend<ObjectType>()
    expectTypeOf(TestActor.id).toEqualTypeOf<"testActor">()
    expectTypeOf(TestActor.properties).toEqualTypeOf<{}>()
  })

  it("rejects definitions that break the object contract", () => {
    expect(() =>
      defineTestModel({
        interfaces: [TestActor],
        links: [],
        name: "Wrong parent",
        objects: [
          defineObject({
            id: "orphan",
            collection: "orphans",
            name: "Orphan",
            pluralName: "Orphans",
            // @ts-expect-error A parent is an object, an interface, or Root.
            parent: EnrollmentFailed,
            properties: { name: schema.string() },
            display: { title: "name" },
          }),
        ],
      })
    ).toThrow(/parent type/)
    expect(() =>
      defineObject({
        id: "mislabeled",
        collection: "mislabeleds",
        name: "Mislabeled",
        pluralName: "Mislabeleds",
        properties: { name: schema.string() },
        // @ts-expect-error Display roles name the object's own properties.
        display: { title: "label" },
      })
    ).toThrow(/display title references unknown property 'label'/)
    expect(() =>
      defineObject({
        id: "unsearchable",
        collection: "unsearchables",
        name: "Unsearchable",
        pluralName: "Unsearchables",
        properties: { name: schema.string() },
        display: { title: "name" },
        // @ts-expect-error Search fields name the object's own properties.
        search: { fields: ["label"] },
      })
    ).toThrow(/search field 'label' must be text/)
    expect(
      defineObject({
        id: "extra",
        collection: "extras",
        name: "Extra",
        pluralName: "Extras",
        properties: { name: schema.string() },
        display: { title: "name" },
        // @ts-expect-error Unknown members are rejected instead of inferred.
        legacyName: "Extra",
      })
    ).not.toHaveProperty("legacyName")
    expect(() =>
      defineObject({
        id: "duplicated",
        collection: "duplicateds",
        name: "Duplicated",
        pluralName: "Duplicateds",
        properties: { name: schema.string() },
        display: { title: "name" },
        actions: {
          ping: { name: "Ping", description: "Pings.", scope: "collection" },
        },
        queries: {
          ping: { name: "Ping", description: "Pings.", scope: "collection" },
        },
      })
    ).toThrow(/duplicates operation 'ping'/)
    expect(() =>
      defineObject({
        id: "redefined",
        collection: "redefineds",
        name: "Redefined",
        pluralName: "Redefineds",
        properties: { name: schema.string() },
        display: { title: "name" },
        actions: {
          create: {
            name: "Create",
            description: "Creates.",
            scope: "collection",
          },
        },
      })
    ).toThrow(/standard action 'create' may only be disabled with false/)
  })
})

describe("model definitions", () => {
  it("indexes objects and their first-class actions", () => {
    const model = defineTestModel({
      interfaces: [TestActor],
      name: "Example",
      objects: [Contact],
      links: [],
    })

    expect(Object.keys(model.modules)).toEqual(["test"])
    expect(model.modules.test).toMatchObject({
      id: "test",
      kind: "module",
      name: "Test",
    })
    expect(Object.keys(model.objects)).toEqual(["contact"])
    expect(model.root).toEqual(Root)
    expect(model.objects.contact.parent).toEqual({
      kind: "root",
      typeId: "root",
    })
    expect(model.objects.contact.uniqueBy).toEqual({ name: ["name"] })
    expect(Object.keys(model.actions.contact)).toEqual([
      "create",
      "update",
      "delete",
      "batchDelete",
      "enroll",
    ])
    expect(model.actions.contact.enroll).toMatchObject({
      id: "enroll",
      objectType: "contact",
      scope: "object",
    })
    expect(model.actions.contact.enroll.input.properties).toHaveProperty("id")
    expect(model.actions.contact.create).toMatchObject({
      input: {
        properties: {
          name: { kind: "string", requiredOnCreate: true },
        },
      },
      output: { properties: { id: { kind: "recordId" } } },
    })
    expect(model.actions.contact.create.input.properties.aliases).toMatchObject(
      { kind: "optional", value: { kind: "array" } }
    )
    expect(
      model.actions.contact.create.output.properties.aliases
    ).toMatchObject({ kind: "array" })
    expect(model.actions.contact.update).toMatchObject({
      input: { properties: { name: { kind: "optional" } } },
    })
    expect(model.actions.contact.update.input.properties.aliases).toMatchObject(
      { kind: "optional", value: { kind: "union" } }
    )
    expect(Object.keys(model.queries.contact)).toEqual([
      "get",
      "list",
      "batchGet",
    ])
    expect(model.actions.contact.batchDelete).toMatchObject({
      input: { properties: { ids: { kind: "array" } } },
      scope: "collection",
    })
    expectTypeOf(model.objects.contact.collection).toEqualTypeOf<"contacts">()
    expectTypeOf(model.objects.contact.parent.typeId).toEqualTypeOf<"root">()
    expectTypeOf(model.actions.contact.enroll.id).toEqualTypeOf<"enroll">()
    expect(model.actions.contact).toBe(model.objects.contact.actions)
  })

  it("rejects duplicate module ids", () => {
    const module = defineModule({
      id: "contacts",
      interfaces: [TestActor],
      links: [],
      name: "Contacts",
      objects: [Contact],
    })

    expect(() =>
      defineModel({
        modules: [module, module],
        name: "Duplicate modules",
      })
    ).toThrow("Module id 'contacts' is registered more than once.")
  })

  it("allows batch deletion to be disabled independently of deletion", () => {
    const WithoutBatchDelete = defineObject({
      id: "withoutBatchDelete",
      collection: "withoutBatchDeletes",
      name: "Without batch delete",
      pluralName: "Without batch deletes",
      properties: { name: schema.string() },
      display: { title: "name" },
      actions: { batchDelete: false },
    })
    const model = defineTestModel({
      interfaces: [TestActor],
      name: "Without batch delete model",
      objects: [WithoutBatchDelete],
      links: [],
    })

    expect(Object.keys(WithoutBatchDelete.actions)).toContain("delete")
    expect(Object.keys(WithoutBatchDelete.actions)).not.toContain("batchDelete")
    expect(Object.keys(model.actions.withoutBatchDelete)).toContain("delete")
    expect(Object.keys(model.actions.withoutBatchDelete)).not.toContain(
      "batchDelete"
    )
  })

  it("rejects duplicate object identities and collections", () => {
    const OtherContact = defineObject({
      id: "contact",
      collection: "otherContacts",
      name: "Other contact",
      pluralName: "Other contacts",
      properties: { name: schema.string() },
      display: { title: "name" },
    })
    expect(() =>
      defineTestModel({
        interfaces: [TestActor],
        name: "Example",
        objects: [Contact, OtherContact],
        links: [],
      })
    ).toThrow(/Object id 'contact'/)

    const SameCollection = defineObject({
      id: "person",
      collection: "contacts",
      name: "Person",
      pluralName: "People",
      properties: { name: schema.string() },
      display: { title: "name" },
    })
    expect(() =>
      defineTestModel({
        interfaces: [TestActor],
        name: "Example",
        objects: [Contact, SameCollection],
        links: [],
      })
    ).toThrow(/collection 'contacts'/)
  })

  it("rejects unique rules that reference unknown fields", () => {
    const InvalidUnique = defineObject({
      id: "invalidUnique",
      collection: "invalidUniques",
      display: { title: "name" },
      name: "Invalid unique",
      pluralName: "Invalid uniques",
      properties: { name: schema.string() },
      uniqueBy: { missing: ["missing"] },
    })

    expect(() =>
      defineTestModel({
        interfaces: [TestActor],
        links: [],
        name: "Invalid unique model",
        objects: [InvalidUnique],
      })
    ).toThrow(/unique rule 'missing' references unknown field 'missing'/)
  })

  it("keeps single-link uniqueness in link cardinality", () => {
    const Account = defineObject({
      id: "account",
      collection: "accounts",
      display: { title: "name" },
      name: "Account",
      pluralName: "Accounts",
      properties: { name: schema.string() },
    })
    const Profile = defineObject({
      id: "profile",
      collection: "profiles",
      display: { title: "name" },
      name: "Profile",
      pluralName: "Profiles",
      properties: { name: schema.string() },
      uniqueBy: { account: ["account"] },
    })
    const ProfileAccount = defineLink({
      id: "profileAccount",
      writeFrom: "account",
      forward: {
        cardinality: "one",
        from: Profile,
        key: "account",
        label: "Account",
        to: Account,
      },
      name: "Profile account",
      reverse: {
        cardinality: "many",
        from: Account,
        key: "profiles",
        label: "Profiles",
        to: Profile,
      },
    })

    expect(() =>
      defineTestModel({
        interfaces: [TestActor],
        links: [ProfileAccount],
        name: "Invalid link unique model",
        objects: [Account, Profile],
      })
    ).toThrow(/references unknown field 'account'/)
  })

  it("registers the kernel interfaces before any module", () => {
    const model = defineTestModel({
      interfaces: [],
      links: [],
      name: "Kernel",
      objects: [Contact],
    })
    expect(Object.keys(model.interfaces)).toEqual(["actor"])
    expect(model.actor.id).toBe("actor")
    expect(() =>
      defineTestModel({
        interfaces: [
          defineInterface({ id: "actor", name: "Actor", pluralName: "Actors" }),
        ],
        links: [],
        name: "Duplicate actor",
        objects: [Contact],
      })
    ).toThrow("Interface id 'actor' is registered more than once.")
  })

  it("derives module dependencies from referenced types and links", () => {
    const Company = defineObject({
      id: "company",
      collection: "companies",
      name: "Company",
      pluralName: "Companies",
      properties: { name: schema.string() },
      display: { title: "name" },
    })
    const ContactCompanies = defineLink({
      id: "contactCompanies",
      writeFrom: "companies",
      name: "Contact companies",
      forward: {
        cardinality: "many",
        from: Contact,
        key: "companies",
        label: "Companies",
        to: Company,
      },
      reverse: {
        cardinality: "many",
        from: Company,
        key: "contacts",
        label: "Contacts",
        to: Contact,
      },
    })
    const PrimaryCompany = defineLink({
      id: "contactPrimaryCompany",
      subsetOf: ContactCompanies,
      writeFrom: "primaryCompany",
      name: "Primary company",
      forward: {
        cardinality: "zeroOrOne",
        from: Contact,
        key: "primaryCompany",
        label: "Primary company",
        to: Company,
      },
      reverse: {
        cardinality: "many",
        from: Company,
        key: "primaryContacts",
        label: "Primary contacts",
        to: Contact,
      },
    })
    const contacts = defineModule({
      id: "contacts",
      name: "Contacts",
      objects: [Contact],
    })
    const companies = defineModule({
      id: "companies",
      name: "Companies",
      links: [ContactCompanies],
      objects: [Company],
    })
    const roles = defineModule({
      id: "roles",
      name: "Roles",
      links: [PrimaryCompany],
      objects: [],
    })
    const model = defineModel({
      modules: [contacts, companies, roles],
      name: "Dependencies",
    })

    expect(Object.keys(enableModules(model, ["contacts"]).modules)).toEqual([
      "contacts",
    ])
    expect(() => enableModules(model, ["companies"])).toThrow(
      "Module 'companies' depends on module 'contacts' (link 'contactCompanies' references 'contact'), which is not enabled."
    )
    expect(() => enableModules(model, ["contacts", "roles"])).toThrow(
      "Module 'roles' depends on module 'companies' (link 'contactPrimaryCompany' references 'company'), which is not enabled."
    )
  })

  it("rejects object references absent from the model", () => {
    const Account = defineObject({
      id: "account",
      collection: "accounts",
      name: "Account",
      pluralName: "Accounts",
      properties: { name: schema.string() },
      display: { title: "name" },
    })
    expect(() =>
      defineObject({
        id: "membership",
        collection: "memberships",
        name: "Membership",
        parent: Account,
        pluralName: "Memberships",
        properties: { account: schema.reference(Account) },
        display: { title: "account" },
      })
    ).toThrow(/use the standard 'parent'/)

    const Membership = defineObject({
      id: "membership",
      collection: "memberships",
      name: "Membership",
      parent: Account,
      pluralName: "Memberships",
      properties: { name: schema.string() },
      display: { title: "name" },
    })

    expectTypeOf(Membership.parent.typeId).toEqualTypeOf<"account">()
    const completeModel = defineTestModel({
      interfaces: [TestActor],
      name: "Complete",
      objects: [Account, Membership],
      links: [],
    })
    expect(completeModel.actions.membership.create.input).toMatchObject({
      properties: {
        parent: { kind: "recordId", typeId: "account" },
      },
    })

    expect(() =>
      defineTestModel({
        interfaces: [TestActor],
        name: "Example",
        objects: [Membership],
        links: [],
      })
    ).toThrow(/parent type 'account' is not registered as object/)
  })

  it("names public record references by their semantic role", () => {
    const Account = defineObject({
      id: "account",
      collection: "accounts",
      name: "Account",
      pluralName: "Accounts",
      properties: { name: schema.string() },
      display: { title: "name" },
    })

    expect(() =>
      defineObject({
        id: "membership",
        collection: "memberships",
        name: "Membership",
        pluralName: "Memberships",
        properties: { accountId: schema.reference(Account) },
        display: { title: "accountId" },
      })
    ).toThrow(/record reference 'accountId'.*without an 'Id' suffix/)

    expect(() =>
      defineInterface({
        id: "accountHolder",
        name: "Account holder",
        pluralName: "Account holders",
        properties: { accountId: schema.reference(Account) },
      })
    ).toThrow(/record reference 'accountId'.*without an 'Id' suffix/)

    expect(() =>
      schema.object({ accountIds: schema.array(schema.reference(Account)) })
    ).toThrow(/record reference 'accountIds'.*without an 'Id' suffix/)

    expect(
      schema.object({
        externalId: schema.string(),
        id: schema.reference(Account),
        ids: schema.array(schema.reference(Account)),
      })
    ).toMatchObject({ kind: "struct" })
  })

  it("registers first-class bidirectional links", () => {
    const Company = defineObject({
      id: "company",
      collection: "companies",
      name: "Company",
      pluralName: "Companies",
      properties: { name: schema.string() },
      display: { title: "name" },
    })
    const CompanyContact = defineObject({
      id: "companyContact",
      collection: "companyContacts",
      name: "Company contact",
      pluralName: "Company contacts",
      properties: { name: schema.string() },
      display: { title: "name" },
    })
    const Contacts = defineLink({
      id: "companyContacts",
      writeFrom: "company",
      name: "Company contacts",
      forward: {
        from: CompanyContact,
        to: Company,
        key: "company",
        cardinality: "one",
        label: "Company",
      },
      reverse: {
        from: Company,
        to: CompanyContact,
        key: "contacts",
        cardinality: "many",
        label: "Contacts",
      },
    })

    const model = defineTestModel({
      interfaces: [TestActor],
      name: "Example",
      objects: [Company, CompanyContact],
      links: [Contacts],
    })

    expect(model.links.companyContacts.forward).toEqual({
      cardinality: "one",
      from: { kind: "object", typeId: "companyContact" },
      key: "company",
      label: "Company",
      to: { kind: "object", typeId: "company" },
    })
    expectTypeOf(
      model.links.companyContacts.reverse.key
    ).toEqualTypeOf<"contacts">()
    expect(model.objects.companyContact.properties).not.toHaveProperty(
      "company"
    )
    expect(
      modelObjectLinkTraversals(model, model.objects.companyContact)[0]
        ?.traversal.key
    ).toBe("company")
  })

  it("keeps generated Query, Action, and Link method names unambiguous", () => {
    const ConflictingAction = defineObject({
      id: "conflictingAction",
      collection: "conflictingActions",
      name: "Conflicting action",
      pluralName: "Conflicting actions",
      properties: { name: schema.string() },
      display: { title: "name" },
      actions: {
        list: {
          description: "Conflicts with the generated list Query.",
          name: "List",
          scope: "collection",
        },
      },
    })
    expect(() =>
      defineTestModel({
        interfaces: [TestActor],
        links: [],
        name: "Conflicting action",
        objects: [ConflictingAction],
      })
    ).toThrow(/Action 'conflictingAction\.list'.*generated Query method/)

    const Account = defineObject({
      id: "account",
      collection: "accounts",
      name: "Account",
      pluralName: "Accounts",
      properties: { name: schema.string() },
      display: { title: "name" },
    })
    const ConflictingLink = defineLink({
      id: "conflictingLink",
      writeFrom: false,
      name: "Conflicting link",
      forward: {
        cardinality: "many",
        from: Contact,
        key: "get",
        label: "Accounts",
        to: Account,
      },
      reverse: {
        cardinality: "many",
        from: Account,
        key: "contacts",
        label: "Contacts",
        to: Contact,
      },
    })
    expect(() =>
      defineTestModel({
        interfaces: [TestActor],
        links: [ConflictingLink],
        name: "Conflicting Link",
        objects: [Account, Contact],
      })
    ).toThrow(/Link traversal 'contact\.get'.*Query or Action method/)
  })

  it("derives singular reference ownership independently of direction", () => {
    const Company = defineObject({
      id: "company",
      collection: "companies",
      name: "Company",
      pluralName: "Companies",
      properties: { name: schema.string() },
      display: { title: "name" },
    })
    const Employee = defineObject({
      id: "employee",
      collection: "employees",
      name: "Employee",
      pluralName: "Employees",
      properties: { name: schema.string() },
      display: { title: "name" },
    })

    const CompanyEmployees = defineLink({
      id: "companyEmployees",
      writeFrom: "employees",
      name: "Company employees",
      forward: {
        from: Company,
        to: Employee,
        key: "employees",
        cardinality: "many",
        label: "Employees",
      },
      reverse: {
        from: Employee,
        to: Company,
        key: "company",
        cardinality: "one",
        label: "Company",
      },
    })
    const model = defineTestModel({
      interfaces: [TestActor],
      links: [CompanyEmployees],
      name: "Company employees",
      objects: [Company, Employee],
    })

    expect(model.objects.employee.properties).not.toHaveProperty("company")

    expect(() =>
      defineLink({
        id: "invalidReverse",
        writeFrom: "employees",
        name: "Invalid reverse",
        forward: {
          cardinality: "many",
          from: Company,
          key: "employees",
          label: "Employees",
          to: Employee,
        },
        reverse: {
          cardinality: "one",
          // @ts-expect-error The reverse source must equal the forward target.
          from: Company,
          key: "company",
          label: "Company",
          to: Company,
        },
      })
    ).toThrow(/reverse traversal must mirror/)
  })

  it("allows interface endpoints without deriving hidden properties", () => {
    const Party = defineInterface({
      id: "party",
      name: "Party",
      pluralName: "Parties",
      properties: { name: schema.string() },
      display: { title: "name" },
    })
    const Activity = defineObject({
      id: "activity",
      collection: "activities",
      name: "Activity",
      pluralName: "Activities",
      properties: { name: schema.string() },
      display: { title: "name" },
    })
    const InvalidOwner = defineLink({
      id: "invalidOwner",
      writeFrom: "activity",
      name: "Invalid owner",
      forward: {
        from: Party,
        to: Activity,
        key: "activity",
        cardinality: "zeroOrOne",
        label: "Activity",
      },
      reverse: {
        from: Activity,
        to: Party,
        key: "parties",
        cardinality: "many",
        label: "Parties",
      },
    })

    const model = defineTestModel({
      interfaces: [TestActor, Party],
      links: [InvalidOwner],
      name: "Test",
      objects: [Activity],
    })
    expect(model.links.invalidOwner.forward.from.kind).toBe("interface")
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
      pluralName: "Companies",
      properties: {
        logo: schema.image({ nullable: true }),
        legalName: schema.string(),
      },
      display: { icon: "building", image: "logo", title: "legalName" },
      implements: [
        {
          interface: Party,
          propertyMapping: { image: "logo", name: "legalName" },
        },
      ],
    })

    const model = defineTestModel({
      name: "Example",
      interfaces: [TestActor, Party],
      objects: [Company],
      links: [],
    })

    expect(model.interfaces.party.display?.icon).toBe("party")
    expect(model.objects.company.interfaces.party).toEqual({
      interfaceId: "party",
      propertyMapping: { image: "logo", name: "legalName" },
    })
    expectTypeOf(
      model.objects.company.interfaces.party.interfaceId
    ).toEqualTypeOf<"party">()
    expectTypeOf(
      model.objects.company.interfaces.party.propertyMapping
    ).toEqualTypeOf<{ readonly image: "logo"; readonly name: "legalName" }>()

    expect(() =>
      defineObject({
        id: "person",
        collection: "people",
        name: "Person",
        pluralName: "People",
        properties: { name: schema.string() },
        display: { title: "name" },
        implements: [
          {
            interface: Party,
            // @ts-expect-error Every property-bearing interface requires a complete mapping.
            propertyMapping: { name: "name" },
          },
        ],
      })
    ).toThrow(/must map exactly/)

    expect(() =>
      defineObject({
        id: "duplicateParty",
        collection: "duplicateParties",
        name: "Duplicate party",
        pluralName: "Duplicate parties",
        properties: {
          image: schema.image({ nullable: true }),
          name: schema.string(),
        },
        display: { title: "name" },
        implements: [
          {
            interface: Party,
            propertyMapping: { image: "image", name: "name" },
          },
          {
            interface: Party,
            propertyMapping: { image: "image", name: "name" },
          },
        ],
      })
    ).toThrow(/implements interface 'party' more than once/)
  })
})

describe("relationship names", () => {
  const model = (key: string) =>
    defineTestModel({
      interfaces: [TestActor],
      name: "Inverse names",
      links: [],
      objects: [
        Contact,
        defineObject({
          id: "message",
          collection: "messages",
          name: "Message",
          pluralName: "Messages",
          display: { title: "recipient" },
          properties: {
            recipient: schema.reference(Contact, {
              inverse: { key, label: "Messages" },
            }),
          },
        }),
      ],
    })
  it("rejects inverse keys that collide with properties or methods", () => {
    expect(() => model("name")).toThrow(
      "conflicts with another relationship, property, or method"
    )
    expect(() => model("get")).toThrow(
      "conflicts with another relationship, property, or method"
    )
    expect(() => model("invalid.key")).toThrow(
      "must be an immutable lower-camel identifier"
    )
    expect(() => model("receivedMessages")).not.toThrow()
  })
})

describe("root definitions", () => {
  it("supports marker interfaces without property or display boilerplate", () => {
    const Workspace = defineObject({
      id: "workspace",
      implements: [{ interface: WorkspaceMarker }],
      collection: "workspaces",
      display: { title: "name" },

      name: "Workspace",
      pluralName: "Workspaces",
      properties: { name: schema.string() },
    })
    const Permission = defineObject({
      id: "permission",
      collection: "permissions",
      display: { title: "name" },
      name: "Permission",
      pluralName: "Permissions",
      properties: { name: schema.string() },
    })
    const PermissionScope = defineLink({
      id: "permissionScope",
      writeFrom: "scope",
      forward: {
        cardinality: "one",
        from: Permission,
        key: "scope",
        label: "Scope",
        to: WorkspaceMarker,
      },
      name: "Permission scope",
      reverse: {
        cardinality: "many",
        from: WorkspaceMarker,
        key: "permissions",
        label: "Permissions",
        to: Permission,
      },
    })
    const model = defineTestModel({
      interfaces: [TestActor, WorkspaceMarker],
      links: [PermissionScope],
      name: "Scoped model",
      objects: [Workspace, Permission],
    })

    expect(model.interfaces.workspaceMarker.properties).toEqual({})
    expect(model.interfaces.workspaceMarker.display).toBeUndefined()
    expect(model.root.interfaces).toEqual({})
    expect(model.objects.permission.properties).not.toHaveProperty("scope")
    expect(
      modelObjectLinkTraversals(model, model.objects.permission)[0]?.target.from
        .typeId
    ).toBe("workspaceMarker")
    expect(modelTypeAccepts(model, "root", "workspaceMarker")).toBe(false)
    expect(modelTypeAccepts(model, "workspace", "workspaceMarker")).toBe(true)
    expect(modelTypeAccepts(model, "permission", "workspaceMarker")).toBe(false)
  })

  it("reserves the model-defined root ID within its type registry", () => {
    const OtherRoot = defineObject({
      id: "root",
      collection: "roots",
      name: "Another root",
      pluralName: "Other roots",
      properties: { name: schema.string() },
      display: { title: "name" },
    })

    expect(() =>
      defineTestModel({
        interfaces: [TestActor],
        links: [],
        name: "Root collision",
        objects: [OtherRoot],
      })
    ).toThrow(/Root id 'root' must be unique/)
  })
})

describe("object properties", () => {
  it("uses schemas directly and normalizes object lifecycle behavior", () => {
    const Example = defineObject({
      id: "example",
      collection: "examples",
      name: "Example",
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

  it("normalizes output-only object properties", () => {
    const Example = defineObject({
      id: "exampleOutput",
      collection: "exampleOutputs",
      name: "Example output",
      pluralName: "Example outputs",
      properties: {
        result: schema.string({ nullable: true, outputOnly: true }),
        title: schema.string(),
      },
      display: { title: "title" },
    })

    expect(Example.properties.result).toMatchObject({
      nullable: true,
      outputOnly: true,
      requiredOnCreate: false,
    })
  })
})

it("keeps module provenance and maintainer defaults when selecting enabled modules", () => {
  const maintainer = {
    name: "Company engineering",
    email: "engineering@example.test",
  }
  const module = defineModule({
    id: "owned",
    name: "Owned",
    objects: [],
    maturity: "beta",
    maintainer: { name: "Operations", email: "ops@example.test" },
    origin: { name: "Upstream", url: "https://example.test/source" },
  })
  const model = defineModel({
    name: "Example",
    maintainer,
    modules: [
      module,
      defineModule({ id: "extra", name: "Extra", objects: [] }),
    ],
  })
  const active = enableModules(model, ["owned"])
  expect(active.maintainer).toEqual(maintainer)
  expect(active.modules.owned.maintainer).toEqual(module.maintainer)
  expect(active.modules.owned.maturity).toBe("beta")
  expect(active.modules.owned.origin).toEqual(module.origin)
})
