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
  type ObjectRecord,
  type ObjectType,
} from "#/runtime/model/definition/object.ts"
import {
  type RecordIdentifier,
  schema,
} from "#/runtime/model/definition/schema.ts"
import {
  defineAction,
  defineQuery,
  type Action,
} from "#/runtime/model/index.ts"

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
})
const ContactEnroll = defineAction({
  id: "enroll",
  object: Contact,
  name: "Enroll contact",
  description: "Enrolls a contact in the customer program.",
  input: { id: schema.id(Contact), notify: schema.optional(schema.boolean()) },
  output: { enrolled: schema.boolean() },
  errors: [EnrollmentFailed],
})

function defineTestModel<
  const TObjects extends ReadonlyArray<ObjectType>,
  const TLinks extends ReadonlyArray<LinkType>,
  const TInterfaces extends ReadonlyArray<InterfaceType>,
  const TActions extends ReadonlyArray<Action> = readonly [],
>(definition: {
  actions?: TActions
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
    actions: definition.actions ?? [],
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
    expectTypeOf<ObjectRecord<typeof Contact>["name"]>().toEqualTypeOf<string>()
    expectTypeOf<keyof typeof Contact.actions>().toEqualTypeOf<
      "batchDelete" | "create" | "delete" | "update"
    >()
    expect(Contact).not.toHaveProperty("queries")
    expectTypeOf(ContactEnroll.scope).toEqualTypeOf<"object">()
    expectTypeOf<ActionInput<typeof ContactEnroll>>().toEqualTypeOf<{
      readonly id: RecordIdentifier<"contact">
      readonly notify?: boolean
    }>()
    expectTypeOf<ActionOutput<typeof ContactEnroll>>().toEqualTypeOf<{
      readonly enrolled: boolean
    }>()
    expectTypeOf(ContactEnroll.errors).toEqualTypeOf<
      readonly [typeof EnrollmentFailed]
    >()
    expectTypeOf(Contact).toExtend<ObjectType>()
    expectTypeOf(TestActor.id).toEqualTypeOf<"testActor">()
    expectTypeOf(TestActor.properties).toEqualTypeOf<{}>()
  })

  it("rejects definitions that break the object contract", () => {
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
    const ping = {
      id: "ping",
      collection: Contact,
      name: "Ping",
      description: "Pings.",
    } as const
    expect(() =>
      defineModel({
        name: "Duplicate",
        modules: [
          defineModule({
            id: "duplicate",
            name: "Duplicate",
            objects: [Contact],
            actions: [defineAction(ping)],
            queries: [defineQuery(ping)],
          }),
        ],
      })
    ).toThrow(/Duplicate operation/)
    expect(() =>
      defineObject({
        id: "redefined",
        collection: "redefineds",
        name: "Redefined",
        pluralName: "Redefineds",
        properties: { name: schema.string() },
        display: { title: "name" },
        actions: {
          // @ts-expect-error Standard actions can only be disabled.
          create: {
            name: "Create",
            description: "Creates.",
            scope: "collection",
          },
        },
      })
    ).toThrow(/must be a standard operation disabled with false/)
  })
})

describe("model definitions", () => {
  it("indexes objects and their first-class actions", () => {
    const model = defineTestModel({
      actions: [ContactEnroll],
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
    expect(model.objects.contact.uniqueBy).toEqual({ name: ["name"] })
    expect(Object.keys(model.actions)).toEqual([
      "contact.create",
      "contact.update",
      "contact.delete",
      "contact.batchDelete",
      "contact.enroll",
    ])
    expect(model.actions["contact.enroll"]).toMatchObject({
      id: "enroll",
      objectType: "contact",
      scope: "object",
    })
    expect(model.actions["contact.enroll"].input.properties).toHaveProperty(
      "id"
    )
    expect(model.actions["contact.create"]).toMatchObject({
      id: "create",
      kind: "action",
      objectType: "contact",
      scope: "collection",
    })
    expect(model.actions["contact.create"]).not.toHaveProperty("input")
    expect(model.actions["contact.update"]).toMatchObject({
      id: "update",
      kind: "action",
      objectType: "contact",
      scope: "object",
    })
    expect(Object.keys(model.queries)).toEqual([
      "contact.get",
      "contact.list",
      "contact.batchGet",
    ])
    expect(model.actions["contact.batchDelete"]).toMatchObject({
      scope: "collection",
    })
    expectTypeOf(model.objects.contact.collection).toEqualTypeOf<"contacts">()
    expectTypeOf(model.actions["contact.enroll"].id).toEqualTypeOf<"enroll">()
    expect(model.actions["contact.create"]).toBe(
      model.objects.contact.actions.create
    )
  })

  it("rejects duplicate module ids", () => {
    const module = defineModule({
      id: "contacts",
      interfaces: [TestActor],
      links: [],
      name: "Contacts",
      objects: [Contact],
      actions: [ContactEnroll],
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
    expect(Object.values(model.actions).map((action) => action.id)).toContain(
      "delete"
    )
    expect(
      Object.values(model.actions).map((action) => action.id)
    ).not.toContain("batchDelete")
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

  it("accepts singular traversals in compound uniqueness rules", () => {
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
      from: Profile,
      to: Account,
      forward: {
        min: 1,
        max: 1,
        key: "account",
        label: "Account",
      },
      name: "Profile account",
      reverse: {
        min: 0,
        key: "profiles",
        label: "Profiles",
      },
    })

    expect(() =>
      defineTestModel({
        interfaces: [TestActor],
        links: [ProfileAccount],
        name: "Invalid link unique model",
        objects: [Account, Profile],
      })
    ).not.toThrow()
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
      from: Contact,
      to: Company,
      id: "contactCompanies",
      name: "Contact companies",
      forward: {
        min: 0,
        key: "companies",
        label: "Companies",
      },
      reverse: {
        min: 0,
        key: "contacts",
        label: "Contacts",
      },
    })
    const PrimaryCompany = defineLink({
      id: "contactPrimaryCompany",
      subsetOf: ContactCompanies,
      name: "Primary company",
      from: Contact,
      to: Company,
      forward: {
        min: 0,
        max: 1,
        key: "primaryCompany",
        label: "Primary company",
      },
      reverse: {
        min: 0,
        key: "primaryContacts",
        label: "Primary contacts",
      },
    })
    const contacts = defineModule({
      id: "contacts",
      name: "Contacts",
      objects: [Contact],
      actions: [ContactEnroll],
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

  it("requires registered endpoints for links", () => {
    const Company = defineObject({
      id: "company",
      collection: "companies",
      name: "Company",
      pluralName: "Companies",
      properties: { name: schema.string() },
      display: { title: "name" },
    })
    const Owner = defineLink({
      id: "contactCompany",
      name: "Contact company",
      from: Contact,
      to: Company,
      forward: { key: "company", label: "Company", max: 1 },
      reverse: { key: "contacts", label: "Contacts" },
    })
    expect(() =>
      defineTestModel({
        interfaces: [TestActor],
        name: "Missing",
        objects: [Contact],
        links: [Owner],
      })
    ).toThrow(/company/)
  })

  it("keeps record identifiers in action schemas and relationships in links", () => {
    expect(() =>
      defineObject({
        id: "membership",
        collection: "memberships",
        name: "Membership",
        pluralName: "Memberships",
        properties: { account: schema.id(Contact) },
        display: { title: "id" },
      })
    ).toThrow(/Use defineLink/)
    expect(() =>
      schema.object({
        id: schema.id(Contact),
        ids: schema.array(schema.id(Contact)),
      })
    ).not.toThrow()
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
      name: "Company contacts",
      from: CompanyContact,
      to: Company,
      forward: {
        key: "company",
        min: 1,
        max: 1,
        label: "Company",
      },
      reverse: {
        key: "contacts",
        min: 0,
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
      onDelete: "unlink",
      min: 1,
      max: 1,
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
    })
    const ConflictingActionList = defineAction({
      id: "list",
      collection: ConflictingAction,
      description: "Conflicts with the generated list Query.",
      name: "List",
    })
    expect(() =>
      defineTestModel({
        interfaces: [TestActor],
        links: [],
        name: "Conflicting action",
        objects: [ConflictingAction],
        actions: [ConflictingActionList],
      })
    ).toThrow(/conflicts with a standard operation/)

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
      name: "Conflicting link",
      from: Contact,
      to: Account,
      forward: {
        min: 0,
        key: "get",
        label: "Accounts",
      },
      reverse: {
        min: 0,
        key: "contacts",
        label: "Contacts",
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
      name: "Company employees",
      from: Company,
      to: Employee,
      forward: {
        key: "employees",
        min: 0,
        label: "Employees",
      },
      reverse: {
        key: "company",
        min: 1,
        max: 1,
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
        id: "invalidBounds",
        name: "Invalid bounds",
        from: Company,
        to: Employee,
        forward: { key: "employees", label: "Employees", min: 2, max: 1 },
        reverse: { key: "company", label: "Company" },
      })
    ).toThrow(/bounds/)
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
      name: "Invalid owner",
      from: Party,
      to: Activity,
      forward: {
        key: "activity",
        min: 0,
        max: 1,
        label: "Activity",
      },
      reverse: {
        key: "parties",
        min: 0,
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
  const model = (key: string) => {
    const Message = defineObject({
      id: "message",
      collection: "messages",
      name: "Message",
      pluralName: "Messages",
      properties: { body: schema.string() },
      display: { title: "body" },
    })
    const Recipient = defineLink({
      id: "messageRecipient",
      name: "Message recipient",
      from: Message,
      to: Contact,
      forward: { key: "recipient", label: "Recipient", max: 1 },
      reverse: { key, label: "Messages" },
    })
    return defineTestModel({
      interfaces: [TestActor],
      name: "Relationship names",
      objects: [Contact, Message],
      links: [Recipient],
    })
  }
  it("rejects inverse keys that collide with properties or methods", () => {
    expect(() => model("name")).toThrow("conflicts with")
    expect(() => model("get")).toThrow("conflicts with")
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
      from: Permission,
      to: WorkspaceMarker,
      id: "permissionScope",
      forward: {
        min: 1,
        max: 1,
        key: "scope",
        label: "Scope",
      },
      name: "Permission scope",
      reverse: {
        min: 0,
        key: "permissions",
        label: "Permissions",
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
