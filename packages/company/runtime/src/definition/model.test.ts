import { describe, expect, expectTypeOf, it } from "vitest"

import { defineError } from "./error"
import { defineInterface } from "./interface"
import { defineLink } from "./link"
import { defineModel, modelTypeAccepts } from "./model"
import { defineObject } from "./object"
import { defineRoot } from "./root"
import {
  schema,
  type AnySchema,
  type InferSchema,
  type RecordId,
} from "./schema"

const TestActor = defineInterface({
  id: "testActor",
  name: "Test actor",
  pluralName: "Test actors",
})
const Root = defineRoot({
  id: "root",
  implements: [{ interface: TestActor }],
  name: "Root",
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
  parent: Root,
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

describe("model definitions", () => {
  it("indexes objects and their first-class actions", () => {
    const model = defineModel({
      actor: TestActor,
      interfaces: [TestActor],
      name: "Example",
      objects: [Contact],
      links: [],
      root: Root,
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

  it("allows batch deletion to be disabled independently of deletion", () => {
    const WithoutBatchDelete = defineObject({
      id: "withoutBatchDelete",
      collection: "withoutBatchDeletes",
      name: "Without batch delete",
      parent: Root,
      pluralName: "Without batch deletes",
      properties: { name: schema.string() },
      display: { title: "name" },
      actions: { batchDelete: false },
    })
    const model = defineModel({
      actor: TestActor,
      interfaces: [TestActor],
      name: "Without batch delete model",
      objects: [WithoutBatchDelete],
      links: [],
      root: Root,
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
      parent: Root,
      pluralName: "Other contacts",
      properties: { name: schema.string() },
      display: { title: "name" },
    })
    expect(() =>
      defineModel({
        actor: TestActor,
        interfaces: [TestActor],
        name: "Example",
        objects: [Contact, OtherContact],
        links: [],
        root: Root,
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
        actor: TestActor,
        interfaces: [TestActor],
        name: "Example",
        objects: [Contact, SameCollection],
        links: [],
        root: Root,
      })
    ).toThrow(/collection 'contacts'/)
  })

  it("rejects unique rules that reference unknown fields", () => {
    const InvalidUnique = defineObject({
      id: "invalidUnique",
      collection: "invalidUniques",
      display: { title: "name" },
      name: "Invalid unique",
      parent: Root,
      pluralName: "Invalid uniques",
      properties: { name: schema.string() },
      uniqueBy: { missing: ["missing"] },
    })

    expect(() =>
      defineModel({
        actor: TestActor,
        interfaces: [TestActor],
        links: [],
        name: "Invalid unique model",
        objects: [InvalidUnique],
        root: Root,
      })
    ).toThrow(/unique rule 'missing' references unknown field 'missing'/)
  })

  it("keeps single-link uniqueness in link cardinality", () => {
    const Account = defineObject({
      id: "account",
      collection: "accounts",
      display: { title: "name" },
      name: "Account",
      parent: Root,
      pluralName: "Accounts",
      properties: { name: schema.string() },
    })
    const Profile = defineObject({
      id: "profile",
      collection: "profiles",
      display: { title: "name" },
      name: "Profile",
      parent: Root,
      pluralName: "Profiles",
      properties: { name: schema.string() },
      uniqueBy: { account: ["account"] },
    })
    const ProfileAccount = defineLink({
      id: "profileAccount",
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
      defineModel({
        actor: TestActor,
        interfaces: [TestActor],
        links: [ProfileAccount],
        name: "Invalid link unique model",
        objects: [Account, Profile],
        root: Root,
      })
    ).toThrow(/express single-link uniqueness on the link/)
  })

  it("requires the declared actor interface to have an implementer", () => {
    const Identity = defineInterface({
      id: "identity",
      name: "Identity",
      pluralName: "Identities",
    })
    expect(() =>
      defineModel({
        actor: Identity,
        interfaces: [TestActor, Identity],
        links: [],
        name: "Missing actor",
        objects: [Contact],
        root: Root,
      })
    ).toThrow(/Actor interface 'identity' has no implementer/)
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
    expect(() =>
      defineObject({
        id: "membership",
        collection: "memberships",
        name: "Membership",
        parent: Account,
        pluralName: "Memberships",
        properties: { account: schema.recordId(Account) },
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
    const completeModel = defineModel({
      actor: TestActor,
      interfaces: [TestActor],
      name: "Complete",
      objects: [Account, Membership],
      links: [],
      root: Root,
    })
    expect(completeModel.actions.membership.create.input).toMatchObject({
      properties: {
        parent: { kind: "recordId", typeId: "account" },
      },
    })

    expect(() =>
      defineModel({
        actor: TestActor,
        interfaces: [TestActor],
        name: "Example",
        objects: [Membership],
        links: [],
        root: Root,
      })
    ).toThrow(/parent type 'account' is not registered as object/)
  })

  it("names public record references by their semantic role", () => {
    const Account = defineObject({
      id: "account",
      collection: "accounts",
      name: "Account",
      parent: Root,
      pluralName: "Accounts",
      properties: { name: schema.string() },
      display: { title: "name" },
    })

    expect(() =>
      defineObject({
        id: "membership",
        collection: "memberships",
        name: "Membership",
        parent: Root,
        pluralName: "Memberships",
        properties: { accountId: schema.recordId(Account) },
        display: { title: "accountId" },
      })
    ).toThrow(/record reference 'accountId'.*without an 'Id' suffix/)

    expect(() =>
      defineInterface({
        id: "accountHolder",
        name: "Account holder",
        pluralName: "Account holders",
        properties: { accountId: schema.recordId(Account) },
      })
    ).toThrow(/record reference 'accountId'.*without an 'Id' suffix/)

    expect(() =>
      schema.object({ accountIds: schema.array(schema.recordId(Account)) })
    ).toThrow(/record reference 'accountIds'.*without an 'Id' suffix/)

    expect(
      schema.object({
        externalId: schema.string(),
        id: schema.recordId(Account),
        ids: schema.array(schema.recordId(Account)),
      })
    ).toMatchObject({ kind: "struct" })
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
      properties: { name: schema.string() },
      display: { title: "name" },
    })
    const Contacts = defineLink({
      id: "companyContacts",
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

    const model = defineModel({
      actor: TestActor,
      interfaces: [TestActor],
      name: "Example",
      objects: [Company, CompanyContact],
      links: [Contacts],
      root: Root,
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
    expect(model.objects.companyContact.properties.company).toMatchObject({
      kind: "recordId",
      label: "Company",
      requiredOnCreate: true,
      typeId: "company",
    })
  })

  it("derives singular reference ownership independently of direction", () => {
    const Company = defineObject({
      id: "company",
      collection: "companies",
      name: "Company",
      parent: Root,
      pluralName: "Companies",
      properties: { name: schema.string() },
      display: { title: "name" },
    })
    const Employee = defineObject({
      id: "employee",
      collection: "employees",
      name: "Employee",
      parent: Root,
      pluralName: "Employees",
      properties: { name: schema.string() },
      display: { title: "name" },
    })

    const CompanyEmployees = defineLink({
      id: "companyEmployees",
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
    const model = defineModel({
      actor: TestActor,
      interfaces: [TestActor],
      links: [CompanyEmployees],
      name: "Company employees",
      objects: [Company, Employee],
      root: Root,
    })

    expect(model.objects.employee.properties.company).toMatchObject({
      kind: "recordId",
      typeId: "company",
    })

    expect(() =>
      defineLink({
        id: "invalidReverse",
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

  it("requires a singular reference property to belong to an object", () => {
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
      parent: Root,
      pluralName: "Activities",
      properties: { name: schema.string() },
      display: { title: "name" },
    })
    const InvalidOwner = defineLink({
      id: "invalidOwner",
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

    expect(() =>
      defineModel({
        actor: TestActor,
        interfaces: [TestActor, Party],
        links: [InvalidOwner],
        name: "Test",
        objects: [Activity],
        root: Root,
      })
    ).toThrow(/singular link references must resolve to an object/)
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
          propertyMapping: { image: "logo", name: "legalName" },
        },
      ],
    })

    const model = defineModel({
      actor: TestActor,
      name: "Example",
      interfaces: [TestActor, Party],
      objects: [Company],
      links: [],
      root: Root,
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
        parent: Root,
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

describe("root definitions", () => {
  it("supports marker interfaces without property or display boilerplate", () => {
    const AuthorizationScope = defineInterface({
      id: "authorizationScope",
      name: "Authorization scope",
      pluralName: "Authorization scopes",
    })
    const ScopedRoot = defineRoot({
      id: "root",
      implements: [{ interface: AuthorizationScope }, { interface: TestActor }],
      name: "Root",
    })
    const Workspace = defineObject({
      id: "workspace",
      collection: "workspaces",
      display: { title: "name" },
      implements: [{ interface: AuthorizationScope }],
      name: "Workspace",
      parent: ScopedRoot,
      pluralName: "Workspaces",
      properties: { name: schema.string() },
    })
    const Permission = defineObject({
      id: "permission",
      collection: "permissions",
      display: { title: "name" },
      name: "Permission",
      parent: ScopedRoot,
      pluralName: "Permissions",
      properties: { name: schema.string() },
    })
    const PermissionScope = defineLink({
      id: "permissionScope",
      forward: {
        cardinality: "one",
        from: Permission,
        key: "scope",
        label: "Scope",
        to: AuthorizationScope,
      },
      name: "Permission scope",
      reverse: {
        cardinality: "many",
        from: AuthorizationScope,
        key: "permissions",
        label: "Permissions",
        to: Permission,
      },
    })
    const model = defineModel({
      actor: TestActor,
      interfaces: [TestActor, AuthorizationScope],
      links: [PermissionScope],
      name: "Scoped model",
      objects: [Workspace, Permission],
      root: ScopedRoot,
    })

    expect(model.interfaces.authorizationScope.properties).toEqual({})
    expect(model.interfaces.authorizationScope.display).toBeUndefined()
    expect(model.root.interfaces.authorizationScope).toEqual({
      interfaceId: "authorizationScope",
      propertyMapping: {},
    })
    expectTypeOf<
      InferSchema<typeof model.objects.permission.properties.scope>
    >().toEqualTypeOf<RecordId<"root"> | RecordId<"workspace">>()
    expect(modelTypeAccepts(model, "root", "authorizationScope")).toBe(true)
    expect(modelTypeAccepts(model, "workspace", "authorizationScope")).toBe(
      true
    )
    expect(modelTypeAccepts(model, "permission", "authorizationScope")).toBe(
      false
    )
    expect(() =>
      defineModel({
        actor: TestActor,
        interfaces: [TestActor],
        links: [],
        name: "Missing scope",
        objects: [],
        root: ScopedRoot,
      })
    ).toThrow(/implements interface 'authorizationScope'.*not registered/)
  })

  it("reserves the model-defined root ID within its type registry", () => {
    const OtherRoot = defineObject({
      id: "root",
      collection: "roots",
      name: "Another root",
      parent: Root,
      pluralName: "Other roots",
      properties: { name: schema.string() },
      display: { title: "name" },
    })

    expect(() =>
      defineModel({
        actor: TestActor,
        interfaces: [TestActor],
        links: [],
        name: "Root collision",
        objects: [OtherRoot],
        root: Root,
      })
    ).toThrow(/Root id 'root' must be unique/)
  })

  it("rejects objects defined beneath a different root", () => {
    const OtherRoot = defineRoot({ id: "otherRoot", name: "Other root" })
    const OtherObject = defineObject({
      id: "otherObject",
      collection: "otherObjects",
      name: "Other object",
      parent: OtherRoot,
      pluralName: "Other objects",
      properties: { name: schema.string() },
      display: { title: "name" },
    })

    expect(() =>
      defineModel({
        actor: TestActor,
        interfaces: [TestActor],
        links: [],
        name: "Root mismatch",
        objects: [OtherObject],
        root: Root,
      })
    ).toThrow(/parent type 'otherRoot' is not registered as root/)
  })
})

describe("object properties", () => {
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

  it("rejects output-only object properties", () => {
    expect(invalidProperty(schema.string({ outputOnly: true }))).toThrow(
      /cannot be output-only/
    )
  })
})
