import { describe, expect, expectTypeOf, it } from "vitest"

import { Storage, schemaSql } from "#/app/server/database/schema.ts"
import type { RecordId } from "#/runtime/model/index.ts"
import {
  tableColumns,
  tableName,
  type TableRow,
} from "#/runtime/server/storage/index.ts"

describe("PostgreSQL schema", () => {
  it("projects model fields, relationships, and infrastructure constraints", () => {
    expect(Object.keys(tableColumns(Storage.objects.contact))).toEqual(
      expect.arrayContaining([
        "id",
        "parentId",
        "emailPermission",
        "marketingStatus",
        "photo",
        "name",
        "jobTitle",
        "email",
        "phone",
      ])
    )
    expect(
      Object.keys(tableColumns(Storage.linkTables.contactPrimaryCompany))
    ).toEqual(["forwardId", "reverseId"])
    expectTypeOf<
      TableRow<typeof Storage.objects.deal>["parentId"]
    >().toEqualTypeOf<RecordId<"authorizationScope">>()
    expectTypeOf<
      TableRow<typeof Storage.objects.lineItem>["parentId"]
    >().toEqualTypeOf<RecordId<"deal">>()
    expect(tableName(Storage.interfaces.party)).toBe("interface_party")
    expect(tableName(Storage.interfaces.noteSubject)).toBe(
      "interface_note_subject"
    )
    expect(Object.keys(tableColumns(Storage.objects.note))).toEqual([
      "id",
      "parentId",
      "content",
    ])
    expect(Storage.core.objects.columns.createdAt.type).toBe(
      "timestamp with time zone"
    )
    expect(Storage.objects.deal.columns.expectedCloseDate.type).toBe("date")
    expect(Storage.objects.role.columns.permissions.type).toBe("text[]")
    const ddl = schemaSql
    expect(ddl).toContain(
      '"created_at" timestamp with time zone not null default now()'
    )
    expect(ddl).toContain(
      '"updated_at" timestamp with time zone not null default now()'
    )
    expect(ddl).toContain(`"etag" text not null default '1'`)
    expect(ddl).not.toContain("users_email_unique")
    expect(ddl).toContain('"line_items_object_parent_fk"')
    expect(ddl).toContain("create trigger event_journal_append_only")
    expect(ddl).toContain("create index record_search_document_idx")
  })
})
