import {
  defineLink,
  defineInterface,
  defineModel,
  defineObject,
  defineRoot,
  type RecordId,
  schema,
} from "@continual/runtime"
import { getTableColumns, getTableName } from "drizzle-orm"
import { getTableConfig } from "drizzle-orm/pg-core"
import { describe, expect, expectTypeOf, it } from "vitest"

import { makePostgresSchema } from "./schema"

const Identity = defineInterface({
  id: "identity",
  name: "Identity",
  pluralName: "Identities",
})
const Platform = defineRoot({
  id: "platform",
  implements: [{ interface: Identity }],
  name: "Platform",
})

describe("makePostgresSchema", () => {
  it("projects marker memberships for root and object implementers", () => {
    const AuthorizationScope = defineInterface({
      id: "authorizationScope",
      name: "Authorization scope",
      pluralName: "Authorization scopes",
    })
    const ScopedPlatform = defineRoot({
      id: "platform",
      implements: [{ interface: AuthorizationScope }, { interface: Identity }],
      name: "Platform",
    })
    const Workspace = defineObject({
      id: "workspace",
      collection: "workspaces",
      display: { title: "name" },
      implements: [{ interface: AuthorizationScope }],
      name: "Workspace",
      parent: ScopedPlatform,
      pluralName: "Workspaces",
      properties: { name: schema.string() },
    })
    const Permission = defineObject({
      id: "permission",
      collection: "permissions",
      display: { title: "name" },
      name: "Permission",
      parent: ScopedPlatform,
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
      actor: Identity,
      id: "scopes",
      interfaces: [AuthorizationScope, Identity],
      links: [PermissionScope],
      name: "Scopes",
      objects: [Workspace, Permission],
      root: ScopedPlatform,
    })

    const storage = makePostgresSchema(model)

    expect(getTableName(storage.interfaces.authorizationScope)).toBe(
      "interface_authorization_scope"
    )
    expectTypeOf<
      typeof storage.interfaces.authorizationScope.$inferSelect.id
    >().toEqualTypeOf<RecordId<"platform"> | RecordId<"workspace">>()
    expectTypeOf<
      typeof storage.objects.permission.$inferSelect.scopeId
    >().toEqualTypeOf<RecordId<"platform"> | RecordId<"workspace">>()
    expectTypeOf<
      typeof storage.objects.workspace.$inferSelect.parentId
    >().toEqualTypeOf<RecordId<"platform">>()
  })

  it("projects many-to-many links through one generated junction table", () => {
    const Person = defineObject({
      id: "person",
      collection: "people",
      name: "Person",
      parent: Platform,
      pluralName: "People",
      properties: { name: schema.string() },
      display: { title: "name" },
    })
    const Team = defineObject({
      id: "team",
      collection: "teams",
      name: "Team",
      parent: Platform,
      pluralName: "Teams",
      properties: { name: schema.string() },
      display: { title: "name" },
    })
    const TeamMembership = defineLink({
      id: "teamMembership",
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
      id: "test",
      interfaces: [Identity],
      name: "Test",
      objects: [Person, Team],
      links: [TeamMembership],
      root: Platform,
    })

    const storage = makePostgresSchema(model)

    expect(getTableName(storage.linkTables.teamMembership)).toBe(
      "team_membership"
    )
    expect(
      Object.keys(getTableColumns(storage.linkTables.teamMembership))
    ).toEqual(["teamsId", "membersId"])
    expect(storage.relations.person?.relations.teams?.targetTableName).toBe(
      "team"
    )
    expect(storage.relations.team?.relations.members?.targetTableName).toBe(
      "person"
    )
  })

  it("rejects physical table-name collisions after normalization", () => {
    const Collision = defineObject({
      id: "collision",
      collection: "objects",
      name: "Collision",
      parent: Platform,
      pluralName: "Collisions",
      properties: { name: schema.string() },
      display: { title: "name" },
    })
    const model = defineModel({
      actor: Identity,
      id: "test",
      interfaces: [Identity],
      name: "Test",
      objects: [Collision],
      links: [],
      root: Platform,
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
      parent: Platform,
      pluralName: "Validated records",
      properties: {
        count: schema.number({ maximum: 10, minimum: 1 }),
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
      id: "test",
      interfaces: [Identity],
      name: "Test",
      objects: [ValidatedRecord],
      links: [],
      root: Platform,
    })

    const storage = makePostgresSchema(model)

    expect(getTableConfig(storage.objects.validatedRecord).checks).toEqual([])
    expect(
      getTableConfig(storage.core.objects).checks.map(({ name }) => name)
    ).toEqual(["objects_object_type_check", "objects_parent_required"])
    expect(
      getTableConfig(storage.core.recordAliases).checks.map(({ name }) => name)
    ).toEqual([])
  })
})
