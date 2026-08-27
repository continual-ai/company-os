import {
  defineLink,
  defineInterface,
  defineModel,
  defineModule,
  defineObject,
  defineRoot,
  type RecordId,
  schema,
} from "@company/runtime"
import { getTableColumns, getTableName } from "drizzle-orm"
import { getTableConfig } from "drizzle-orm/pg-core"
import { describe, expect, expectTypeOf, it } from "vitest"

import { makePostgresSchema } from "./schema"

const Identity = defineInterface({
  id: "identity",
  name: "Identity",
  pluralName: "Identities",
})
const Root = defineRoot({
  id: "root",
  implements: [{ interface: Identity }],
  name: "Root",
})

describe("makePostgresSchema", () => {
  it("projects marker memberships for root and object implementers", () => {
    const AuthorizationScope = defineInterface({
      id: "authorizationScope",
      name: "Authorization scope",
      pluralName: "Authorization scopes",
    })
    const ScopedRoot = defineRoot({
      id: "root",
      implements: [{ interface: AuthorizationScope }, { interface: Identity }],
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
      uniqueBy: { name: ["name"] },
    })
    const PermissionScope = defineLink({
      id: "permissionScope",
      writeFrom: "scope",
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
      actor: Identity,
      modules: [
        defineModule({
          id: "scopes",
          interfaces: [AuthorizationScope, Identity],
          links: [PermissionScope],
          name: "Scopes",
          objects: [Workspace, Permission],
        }),
      ],
      name: "Scopes",
      root: ScopedRoot,
    })

    const storage = makePostgresSchema(model)

    expect(getTableName(storage.interfaces.authorizationScope)).toBe(
      "interface_authorization_scope"
    )
    expectTypeOf<
      typeof storage.interfaces.authorizationScope.$inferSelect.id
    >().toEqualTypeOf<RecordId<"root"> | RecordId<"workspace">>()
    expectTypeOf<
      typeof storage.linkTables.permissionScope.$inferSelect.reverseId
    >().toEqualTypeOf<RecordId<"root"> | RecordId<"workspace">>()
    expectTypeOf<
      typeof storage.objects.workspace.$inferSelect.parentId
    >().toEqualTypeOf<RecordId<"root">>()
    expect(
      getTableConfig(storage.objects.permission).indexes.map(
        ({ config }) => config.name
      )
    ).toContain("permissions_name_unique")
  })

  it("projects many-to-many links through one generated junction table", () => {
    const Person = defineObject({
      id: "person",
      collection: "people",
      name: "Person",
      parent: Root,
      pluralName: "People",
      properties: { name: schema.string() },
      display: { title: "name" },
    })
    const Team = defineObject({
      id: "team",
      collection: "teams",
      name: "Team",
      parent: Root,
      pluralName: "Teams",
      properties: { name: schema.string() },
      display: { title: "name" },
    })
    const TeamMembership = defineLink({
      id: "teamMembership",
      writeFrom: "teams",
      name: "Team membership",
      forward: {
        from: Person,
        to: Team,
        key: "teams",
        cardinality: "many",
        label: "Teams",
      },
      reverse: {
        from: Team,
        to: Person,
        key: "members",
        cardinality: "many",
        label: "Members",
      },
    })
    const model = defineModel({
      actor: Identity,
      modules: [
        defineModule({
          id: "teams",
          interfaces: [Identity],
          links: [TeamMembership],
          name: "Teams",
          objects: [Person, Team],
        }),
      ],
      name: "Test",
      root: Root,
    })

    const storage = makePostgresSchema(model)

    expect(getTableName(storage.linkTables.teamMembership)).toBe(
      "team_membership"
    )
    expect(
      Object.keys(getTableColumns(storage.linkTables.teamMembership))
    ).toEqual(["forwardId", "reverseId"])
    expect(storage.relations.person?.relations.teams?.targetTableName).toBe(
      "team"
    )
    expect(storage.relations.team?.relations.members?.targetTableName).toBe(
      "person"
    )
    expect(
      getTableConfig(storage.linkTables.teamMembership).primaryKeys
    ).toHaveLength(1)
  })

  it("derives one-to-one uniqueness from link cardinality", () => {
    const Person = defineObject({
      id: "person",
      collection: "people",
      display: { title: "name" },
      name: "Person",
      parent: Root,
      pluralName: "People",
      properties: { name: schema.string() },
    })
    const Badge = defineObject({
      id: "badge",
      collection: "badges",
      display: { title: "name" },
      name: "Badge",
      parent: Root,
      pluralName: "Badges",
      properties: { name: schema.string() },
    })
    const PersonBadge = defineLink({
      id: "personBadge",
      writeFrom: "badge",
      forward: {
        cardinality: "zeroOrOne",
        from: Person,
        key: "badge",
        label: "Badge",
        to: Badge,
      },
      name: "Person badge",
      reverse: {
        cardinality: "zeroOrOne",
        from: Badge,
        key: "holder",
        label: "Holder",
        to: Person,
      },
    })
    const model = defineModel({
      actor: Identity,
      modules: [
        defineModule({
          id: "badges",
          interfaces: [Identity],
          links: [PersonBadge],
          name: "Badges",
          objects: [Badge, Person],
        }),
      ],
      name: "Badges",
      root: Root,
    })

    const storage = makePostgresSchema(model)

    expect(
      getTableConfig(storage.linkTables.personBadge).indexes.map(
        ({ config }) => config.name
      )
    ).toEqual(
      expect.arrayContaining([
        "person_badge_forward_id_unique",
        "person_badge_reverse_id_unique",
      ])
    )
  })

  it("rejects physical table-name collisions after normalization", () => {
    const Collision = defineObject({
      id: "collision",
      collection: "objects",
      name: "Collision",
      parent: Root,
      pluralName: "Collisions",
      properties: { name: schema.string() },
      display: { title: "name" },
    })
    const model = defineModel({
      actor: Identity,
      modules: [
        defineModule({
          id: "collisions",
          interfaces: [Identity],
          links: [],
          name: "Collisions",
          objects: [Collision],
        }),
      ],
      name: "Test",
      root: Root,
    })

    expect(() => makePostgresSchema(model)).toThrow(
      /table 'objects' is required by both core objects and object 'collision'/
    )
  })

  it("keeps portable property validation out of the storage schema", () => {
    const ValidatedRecord = defineObject({
      id: "validatedRecord",
      collection: "validatedRecords",
      name: "Validated record",
      parent: Root,
      pluralName: "Validated records",
      properties: {
        count: schema.number({ maximum: 10, minimum: 1 }),
        labels: schema.array(schema.string()),
        name: schema.string({ maxLength: 100, minLength: 1 }),
        status: schema.select({
          options: [
            { label: "Active", value: "active" },
            { label: "Inactive", value: "inactive" },
          ],
        }),
      },
      display: { title: "name" },
    })
    const model = defineModel({
      actor: Identity,
      modules: [
        defineModule({
          id: "validation",
          interfaces: [Identity],
          links: [],
          name: "Validation",
          objects: [ValidatedRecord],
        }),
      ],
      name: "Test",
      root: Root,
    })

    const storage = makePostgresSchema(model)

    expect(getTableConfig(storage.objects.validatedRecord).checks).toEqual([])
    expect(
      getTableConfig(storage.core.objects).checks.map(({ name }) => name)
    ).toEqual(["objects_object_type_check", "objects_parent_required"])
    expect(
      getTableConfig(storage.core.recordAliases).checks.map(({ name }) => name)
    ).toEqual([])
    expect(storage.objects.validatedRecord.labels.dimensions).toBe(1)
  })
})
