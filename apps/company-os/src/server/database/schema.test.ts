import type { RecordId } from "@company/runtime"
import { getTableColumns, getTableName, is, Table } from "drizzle-orm"
import { getTableConfig } from "drizzle-orm/pg-core"
import { describe, expect, expectTypeOf, it } from "vitest"

import * as DatabaseSchema from "./schema"

const { Storage } = DatabaseSchema

describe("PostgreSQL schema", () => {
  it("projects object properties, link references, and relation metadata", () => {
    expect(Object.keys(getTableColumns(Storage.objects.contact))).toEqual([
      "id",
      "parentId",
      "photo",
      "name",
      "jobTitle",
      "email",
      "phone",
      "primaryCompanyId",
    ])
    expect(
      Storage.relations.contact?.relations.primaryCompany?.targetTableName
    ).toBe("company")
    expect(Storage.relations.company?.relations.contacts?.relationType).toBe(
      "many"
    )
    expectTypeOf(
      Storage.relations.contact.relations.primaryCompany.targetTableName
    ).toEqualTypeOf<"company">()
    expectTypeOf<
      (typeof Storage.objects.deal)["$inferSelect"]["parentId"]
    >().toEqualTypeOf<RecordId<"company">>()
    expectTypeOf<
      (typeof Storage.objects.lineItem)["$inferSelect"]["parentId"]
    >().toEqualTypeOf<RecordId<"deal">>()
    expect(getTableName(Storage.interfaces.party)).toBe("interface_party")
    const objectColumns = getTableColumns(Storage.core.objects)
    expect(objectColumns.createdAt.getSQLType()).toBe(
      "timestamp with time zone"
    )
    expect(objectColumns.createdAt.hasDefault).toBe(true)
    expect(objectColumns.etag.hasDefault).toBe(true)
    expect(objectColumns.updatedAt.hasDefault).toBe(true)
    expect(Storage.objects.interaction.occurredAt.getSQLType()).toBe(
      "timestamp with time zone"
    )
    expect(Storage.objects.deal.expectedCloseDate.getSQLType()).toBe("date")
    expect(Storage.objects.role.permissions.dimensions).toBe(1)
    expect(
      getTableConfig(Storage.objects.user).indexes.map(
        ({ config }) => config.name
      )
    ).toContain("users_email_unique")
    expect(
      getTableConfig(Storage.objects.lineItem).foreignKeys.map((key) =>
        key.getName()
      )
    ).toContain("line_items_object_parent_fk")

    const kitTables: ReadonlyArray<unknown> = Object.values(
      DatabaseSchema
    ).filter((value) => is(value, Table))
    const expectedKitTables = [
      ...Object.values(Storage.schema),
      DatabaseSchema.authAccount,
      DatabaseSchema.authSession,
      DatabaseSchema.authUser,
      DatabaseSchema.authVerification,
      DatabaseSchema.apiKeyCredentials,
      DatabaseSchema.authUserBindings,
      DatabaseSchema.invitationCredentials,
    ]
    expect(new Set(kitTables)).toEqual(new Set(expectedKitTables))
  })
})
