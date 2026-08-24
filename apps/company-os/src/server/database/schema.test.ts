import type { RecordId } from "@continual/runtime"
import { getTableColumns, getTableName, is, Table } from "drizzle-orm"
import { getTableConfig } from "drizzle-orm/pg-core"
import { describe, expect, expectTypeOf, it } from "vitest"

import * as DatabaseSchema from "./schema.server"

const { AcmeStorage } = DatabaseSchema

describe("Acme PostgreSQL schema", () => {
  it("projects object properties, link references, and relation metadata", () => {
    expect(Object.keys(getTableColumns(AcmeStorage.objects.contact))).toEqual([
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
      AcmeStorage.relations.contact?.relations.primaryCompany?.targetTableName
    ).toBe("company")
    expect(
      AcmeStorage.relations.company?.relations.contacts?.relationType
    ).toBe("many")
    expectTypeOf(
      AcmeStorage.relations.contact.relations.primaryCompany.targetTableName
    ).toEqualTypeOf<"company">()
    expectTypeOf<
      (typeof AcmeStorage.objects.deal)["$inferSelect"]["companyId"]
    >().toEqualTypeOf<RecordId<"company">>()
    expectTypeOf<
      (typeof AcmeStorage.objects.lineItem)["$inferSelect"]["parentId"]
    >().toEqualTypeOf<RecordId<"deal">>()
    expect(getTableName(AcmeStorage.interfaces.party)).toBe("interface_party")
    const objectColumns = getTableColumns(AcmeStorage.core.objects)
    expect(objectColumns.createdAt.getSQLType()).toBe(
      "timestamp with time zone"
    )
    expect(objectColumns.createdAt.hasDefault).toBe(true)
    expect(objectColumns.etag.hasDefault).toBe(true)
    expect(objectColumns.updatedAt.hasDefault).toBe(true)
    expect(AcmeStorage.objects.interaction.occurredAt.getSQLType()).toBe(
      "timestamp with time zone"
    )
    expect(AcmeStorage.objects.deal.expectedCloseDate.getSQLType()).toBe("date")
    expect(AcmeStorage.objects.role.permissions.dimensions).toBe(1)
    expect(
      getTableConfig(AcmeStorage.objects.user).indexes.map(
        ({ config }) => config.name
      )
    ).toContain("users_email_unique")
    expect(
      getTableConfig(AcmeStorage.objects.lineItem).foreignKeys.map((key) =>
        key.getName()
      )
    ).toContain("line_items_object_parent_fk")

    const kitTables: ReadonlyArray<unknown> = Object.values(
      DatabaseSchema
    ).filter((value) => is(value, Table))
    expect(new Set(kitTables)).toEqual(
      new Set(Object.values(AcmeStorage.schema))
    )
  })
})
