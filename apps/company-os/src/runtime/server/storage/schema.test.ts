import { describe, expect, expectTypeOf, it } from "vitest"

import {
  defineLink,
  defineInterface,
  defineModel,
  defineModule,
  defineObject,
  type RecordId,
  schema,
  AuthorizationScope,
} from "#/runtime/model/index.ts"
import { makeSchemaSql } from "#/runtime/server/schema.ts"
import { makePostgresSchema } from "#/runtime/server/storage/schema.ts"
import type { TableRow } from "#/runtime/server/storage/statement.ts"
import {
  tableColumns as getTableColumns,
  tableName as getTableName,
} from "#/runtime/server/storage/table.ts"
import { fixtureModel } from "#/runtime/testing/fixture-model.ts"

const Identity = defineInterface({
  id: "identity",
  name: "Identity",
  pluralName: "Identities",
})

describe("makePostgresSchema", () => {
  it("projects model fields, relationships, and infrastructure constraints", () => {
    const storage = makePostgresSchema(fixtureModel)
    expect(Object.keys(getTableColumns(storage.objects.person))).toEqual([
      "id",
      "parentId",
      "photo",
      "name",
      "email",
      "phone",
      "consent",
    ])
    expect(
      Object.keys(getTableColumns(storage.linkTables.personPrimaryAccount))
    ).toEqual(["forwardId", "reverseId"])
    expectTypeOf<
      TableRow<typeof storage.objects.order>["parentId"]
    >().toEqualTypeOf<RecordId<"authorizationScope">>()
    expectTypeOf<
      TableRow<typeof storage.objects.orderLine>["parentId"]
    >().toEqualTypeOf<RecordId<"order">>()
    expect(getTableName(storage.interfaces.participant)).toBe(
      "interface_participant"
    )
    expect(getTableName(storage.interfaces.topic)).toBe("interface_topic")
    expect(Object.keys(getTableColumns(storage.objects.memo))).toEqual([
      "id",
      "parentId",
      "content",
    ])
    expect(storage.core.objects.columns.createdAt.type).toBe(
      "timestamp with time zone"
    )
    expect(storage.objects.order.columns.expectedCloseDate.type).toBe("date")
    expect(storage.objects.role.columns.permissions.type).toBe("text[]")
    const ddl = makeSchemaSql(fixtureModel)
    expect(ddl).not.toMatch(/\bcomment on (table|column)\b/i)
    expect(ddl).toContain(
      '"created_at" timestamp with time zone not null default now()'
    )
    expect(ddl).toContain(
      '"updated_at" timestamp with time zone not null default now()'
    )
    expect(ddl).toContain(`"etag" text not null default '1'`)
    expect(ddl).not.toContain("users_email_unique")
    expect(ddl).toContain('"order_lines_object_parent_fk"')
    expect(ddl).toContain('create trigger "event_journal_append_only"')
    expect(ddl).toContain('create index "record_search_document_idx"')
  })

  it("projects marker memberships for root and object implementers", () => {
    const Workspace = defineObject({
      id: "workspace",
      collection: "workspaces",
      display: { title: "name" },
      implements: [{ interface: AuthorizationScope }],
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
      modules: [
        defineModule({
          id: "scopes",
          interfaces: [Identity],
          links: [PermissionScope],
          name: "Scopes",
          objects: [Workspace, Permission],
        }),
      ],
      name: "Scopes",
    })

    const storage = makePostgresSchema(model)

    expect(getTableName(storage.interfaces.authorizationScope)).toBe(
      "interface_authorization_scope"
    )
    expectTypeOf<
      TableRow<typeof storage.interfaces.authorizationScope>["id"]
    >().toEqualTypeOf<RecordId<"root"> | RecordId<"workspace">>()
    expectTypeOf<
      TableRow<typeof storage.linkTables.permissionScope>["reverseId"]
    >().toEqualTypeOf<RecordId<"root"> | RecordId<"workspace">>()
    expectTypeOf<
      TableRow<typeof storage.objects.workspace>["parentId"]
    >().toEqualTypeOf<RecordId<"root">>()
    expect(storage.ddl.join("\n")).toContain(
      'create unique index "permissions_name_unique" on "permissions" ("name")'
    )
  })

  it("projects many-to-many links through one generated junction table", () => {
    const Person = defineObject({
      id: "person",
      collection: "people",
      name: "Person",
      pluralName: "People",
      properties: { name: schema.string() },
      display: { title: "name" },
    })
    const Team = defineObject({
      id: "team",
      collection: "teams",
      name: "Team",
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
    })

    const storage = makePostgresSchema(model)

    expect(getTableName(storage.linkTables.teamMembership)).toBe(
      "team_membership"
    )
    expect(
      Object.keys(getTableColumns(storage.linkTables.teamMembership))
    ).toEqual(["forwardId", "reverseId"])
    const ddl = storage.ddl.join("\n")
    expect(ddl).toContain(
      'foreign key ("forward_id") references "people" ("id") on delete cascade'
    )
    expect(ddl).toContain(
      'foreign key ("reverse_id") references "teams" ("id") on delete cascade'
    )
    expect(ddl).toContain('primary key ("forward_id", "reverse_id")')
  })

  it("derives one-to-one uniqueness from link cardinality", () => {
    const Person = defineObject({
      id: "person",
      collection: "people",
      display: { title: "name" },
      name: "Person",
      pluralName: "People",
      properties: { name: schema.string() },
    })
    const Badge = defineObject({
      id: "badge",
      collection: "badges",
      display: { title: "name" },
      name: "Badge",
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
    })

    const storage = makePostgresSchema(model)

    for (const side of ["forward", "reverse"])
      expect(storage.ddl.join("\n")).toContain(
        `create unique index "person_badge_${side}_id_unique" on "person_badge" ("${side}_id")`
      )
  })

  it("rejects physical table-name collisions after normalization", () => {
    const Collision = defineObject({
      id: "collision",
      collection: "objects",
      name: "Collision",
      pluralName: "Collisions",
      properties: { name: schema.string() },
      display: { title: "name" },
    })
    const model = defineModel({
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
    })

    expect(() => makePostgresSchema(model)).toThrow(
      /Duplicate PostgreSQL table 'objects'/
    )
  })

  it("keeps portable property validation out of the storage schema", () => {
    const ValidatedRecord = defineObject({
      id: "validatedRecord",
      collection: "validatedRecords",
      name: "Validated record",
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
    })

    const storage = makePostgresSchema(model)

    const ddl = storage.ddl.join("\n")
    expect(
      storage.ddl.find((statement) =>
        statement.startsWith('create table "validated_records"')
      )
    ).not.toContain("check")
    expect(ddl).toContain('constraint "objects_object_type_check" check')
    expect(ddl).toContain('constraint "objects_parent_required" check')
    expect(
      storage.ddl.find((statement) =>
        statement.startsWith('create table "record_aliases"')
      )
    ).not.toContain("check")
    expect(storage.objects.validatedRecord.columns.labels.type).toBe("text[]")
  })
})
