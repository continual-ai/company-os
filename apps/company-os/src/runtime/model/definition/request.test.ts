import { describe, expect, expectTypeOf, it } from "vitest"

import { defineObject } from "#/runtime/model/definition/object.ts"
import type { ObjectFilter } from "#/runtime/model/definition/request.ts"
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  normalizePageSize,
} from "#/runtime/model/definition/request.ts"
import {
  schema,
  CalendarDate,
  Timestamp,
} from "#/runtime/model/definition/schema.ts"

describe("page-size normalization", () => {
  it("uses the default for omitted and zero values", () => {
    expect(normalizePageSize()).toBe(DEFAULT_PAGE_SIZE)
    expect(normalizePageSize(0)).toBe(DEFAULT_PAGE_SIZE)
  })

  it("preserves ordinary sizes and caps large requests", () => {
    expect(normalizePageSize(25)).toBe(25)
    expect(normalizePageSize(MAX_PAGE_SIZE + 1)).toBe(MAX_PAGE_SIZE)
  })

  it("rejects negative, fractional, and non-finite values", () => {
    expect(() => normalizePageSize(-1)).toThrow("non-negative integer")
    expect(() => normalizePageSize(1.5)).toThrow("non-negative integer")
    expect(() => normalizePageSize(Number.NaN)).toThrow("non-negative integer")
  })
})

it("preserves semantic formats for typed query operators", () => {
  const Item = defineObject({
    id: "scheduledItem",
    name: "Scheduled item",
    pluralName: "Scheduled items",
    collection: "scheduledItems",
    properties: {
      name: schema.string(),
      date: schema.date({ nullable: true }),
      timestamp: schema.timestamp(),
    },
    display: { title: "name" },
  })
  const filters: Array<ObjectFilter<typeof Item>> = [
    { field: "date", operator: "gte", value: CalendarDate("2026-09-21") },
    {
      field: "timestamp",
      operator: "lt",
      value: Timestamp("2026-09-21T00:00:00Z"),
    },
    { field: "date", operator: "isNull" },
    // @ts-expect-error Dates do not accept text operators.
    { field: "date", operator: "contains", value: "2026" },
    // @ts-expect-error Required fields do not accept null filters.
    { field: "timestamp", operator: "isNull" },
  ]
  expect(Item.properties.date.format).toBe("date")
  expect(Item.properties.timestamp.format).toBe("timestamp")
  expectTypeOf(Item.properties.date.format).toEqualTypeOf<"date">()
  expectTypeOf(Item.properties.timestamp.format).toEqualTypeOf<"timestamp">()
  expect(filters[0]).toMatchObject({ operator: "gte" })
})
