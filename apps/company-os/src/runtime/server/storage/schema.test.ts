import { describe, expect, expectTypeOf, it } from "vitest"

import {
  defineInterface,
  defineLink,
  defineModel,
  defineModule,
  defineObject,
  type RecordId,
  schema,
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

const WorkspaceMarker = defineInterface({
  id: "workspaceMarker",
  name: "Workspace",
  pluralName: "Workspaces",
})
describe("makePostgresSchema", () => {
  it("emits valid storage for an empty model without synthetic records", () => {
    const storage = makePostgresSchema(
      defineModel({ name: "Empty", modules: [] })
    )
    const ddl = storage.ddl.join("\n")
    expect(ddl).toContain(
      'constraint "objects_object_type_check" check (false)'
    )
    expect(ddl).not.toContain('create table "roots"')
    expect(storage.core).not.toHaveProperty("roots")
  })

  it("projects model fields, relationships, and infrastructure constraints", () => {
    const storage = makePostgresSchema(fixtureModel)
    expect(Object.keys(getTableColumns(storage.objects.person))).toEqual([
      "id",
      "billing_account_id",
      "photo",
      "name",
      "email",
      "phone",
      "consent",
    ])
    expect(
      Object.keys(getTableColumns(storage.linkTables.personBillingAccount))
    ).toEqual(["forwardId", "reverseId"])
    expect(getTableName(storage.interfaces.participant)).toBe(
      "interface_participant"
    )
    expect(getTableName(storage.interfaces.topic)).toBe("interface_topic")
    expect(Object.keys(getTableColumns(storage.objects.memo))).toEqual([
      "id",
      "content",
    ])
    expect(storage.core.objects.columns.createdAt.type).toBe(
      "timestamp with time zone"
    )
    expect(storage.objects.order.columns.expectedCloseDate.type).toBe("date")
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
    expect(ddl).toContain('create view "link_order_lines"')
    expect(ddl).toContain('create trigger "event_journal_append_only"')
    expect(ddl).toContain('create index "record_search_document_idx"')
  })

  it("projects marker memberships for root and object implementers", () => {
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
      uniqueBy: { name: ["name"] },
    })
    const PermissionScope = defineLink({
      id: "permissionScope",
      name: "Permission scope",
      from: { type: Permission, min: 1, max: 1, key: "scope", label: "Scope" },
      to: {
        type: WorkspaceMarker,
        min: 0,
        key: "permissions",
        label: "Permissions",
      },
    })
    const model = defineModel({
      modules: [
        defineModule({
          id: "scopes",
          interfaces: [Identity, WorkspaceMarker],
          links: [PermissionScope],
          name: "Scopes",
          objects: [Workspace, Permission],
        }),
      ],
      name: "Scopes",
    })

    const storage = makePostgresSchema(model)

    expect(getTableName(storage.interfaces.workspaceMarker)).toBe(
      "interface_workspace_marker"
    )
    expectTypeOf<
      TableRow<typeof storage.interfaces.workspaceMarker>["id"]
    >().toEqualTypeOf<RecordId<"workspace">>()
    expectTypeOf<
      TableRow<typeof storage.linkTables.permissionScope>["reverseId"]
    >().toEqualTypeOf<RecordId<"workspace">>()
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
      name: "Team membership",
      from: { type: Person, key: "teams", min: 0, label: "Teams" },
      to: { type: Team, key: "members", min: 0, label: "Members" },
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
      "link_team_membership"
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
      name: "Person badge",
      from: { type: Person, min: 0, max: 1, key: "badge", label: "Badge" },
      to: { type: Badge, min: 0, max: 1, key: "holder", label: "Holder" },
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

    expect(storage.ddl.join("\n")).toContain(
      'unique ("badge_id") deferrable initially deferred'
    )
    expect(storage.ddl.join("\n")).toContain('create view "link_person_badge"')
    expect(storage.ddl.join("\n")).not.toContain(
      'create function "check_person_badge"'
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
    expect(ddl).not.toContain("parent_id")
    expect(
      storage.ddl.find((statement) =>
        statement.startsWith('create table "record_aliases"')
      )
    ).not.toContain("check")
    expect(storage.objects.validatedRecord.columns.labels.type).toBe("text[]")
  })
})

it("generates cardinality triggers only for non-native bounds and changed relationships", () => {
  const ddl = makePostgresSchema(fixtureModel).ddl.join("\n")
  expect(ddl).not.toContain('create function "check_person_accounts"')
  expect(ddl).not.toContain('create function "lock_person_accounts"')
  expect(ddl).not.toContain('create function "check_person_billing_account"')
  expect(ddl).toContain('create function "check_account_orders"')
  expect(ddl).toContain(
    'when (OLD."account_id" is distinct from NEW."account_id")'
  )
  expect(ddl).toContain(
    'create constraint trigger "require_account_orders_reverse"'
  )
})
