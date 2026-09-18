import { describe, expect, it } from "vitest"

import { validateQuery } from "#/runtime/contract/query-validation.ts"
import { defineObject, PageToken, schema } from "#/runtime/model/index.ts"
import { relationshipFields } from "#/runtime/model/relationship-fields.ts"
import {
  Account,
  Person,
  fixtureModel,
} from "#/runtime/testing/fixture-model.ts"
import { objectListRequest } from "#/runtime/ui/model/object-collection-query.ts"
import { defaultFilterOperator } from "#/runtime/ui/model/object-table/object-table-config.ts"

describe("object collection queries", () => {
  it("projects table filters and sorting into the portable list contract", () => {
    expect(
      objectListRequest(
        Account,
        [
          {
            id: "name",
            value: { operator: "contains", values: ["north"] },
          },
          {
            id: "stage",
            value: { operator: "notEquals", values: ["inactive"] },
          },
        ],
        [{ desc: false, id: "name" }],
        PageToken("account_cursor")
      )
    ).toEqual({
      filter: {
        and: [
          { field: "name", operator: "contains", value: "north" },
          {
            not: {
              field: "stage",
              operator: "eq",
              value: "inactive",
            },
          },
        ],
      },
      pageSize: 100,
      pageToken: "account_cursor",
      sort: [{ direction: "asc", field: "name", nulls: "last" }],
    })
  })

  it("projects relationships into graph membership filters, including empty links", () => {
    expect(
      defaultFilterOperator({
        ...schema.id(Account),
        nullable: true,
        immutable: false,
        outputOnly: false,
        requiredOnCreate: false,
      })
    ).toBe("equals")
    expect(
      objectListRequest(
        Person,
        [
          {
            id: "accounts",
            value: { operator: "equals", values: ["account_a", "account_b"] },
          },
          { id: "billingAccount", value: { operator: "notEmpty", values: [] } },
        ],
        [],
        undefined,
        undefined,
        fixtureModel
      )
    ).toEqual({
      pageSize: 100,
      filter: {
        and: [
          {
            or: [
              { link: "accounts", contains: "account_a" },
              { link: "accounts", contains: "account_b" },
            ],
          },
          { not: { link: "billingAccount", isEmpty: true } },
        ],
      },
    })
    expect(
      objectListRequest(
        Person,
        [
          {
            id: "accounts",
            value: { operator: "notEquals", values: ["account_a"] },
          },
          { id: "billingAccount", value: { operator: "empty", values: [] } },
        ],
        [],
        undefined,
        undefined,
        fixtureModel
      )
    ).toEqual({
      pageSize: 100,
      filter: {
        and: [
          { not: { or: [{ link: "accounts", contains: "account_a" }] } },
          { link: "billingAccount", isEmpty: true },
        ],
      },
    })
  })

  it("rejects filters for unsupported presentation values", () => {
    expect(() =>
      objectListRequest(
        Account,
        [{ id: "logo", value: { operator: "contains", values: ["asset"] } }],
        []
      )
    ).toThrow("Field 'logo' does not support filter.")
  })
})

it("uses quantified related filters and exact count sorts in table requests", () => {
  expect(
    objectListRequest(
      Person,
      [
        {
          id: "accounts.name",
          value: { operator: "contains", values: ["Acme"] },
        },
      ],
      [{ id: "accounts.$count", desc: true }],
      undefined,
      undefined,
      fixtureModel
    )
  ).toEqual({
    pageSize: 100,
    filter: {
      link: "accounts",
      some: { field: "name", operator: "contains", value: "Acme" },
    },
    sort: [
      {
        field: "accounts",
        aggregate: "count",
        direction: "desc",
        nulls: "last",
      },
    ],
  })
})

it("preserves quantified negation and supports relationship count filters", () => {
  expect(
    objectListRequest(
      Person,
      [
        {
          id: "accounts.name",
          value: { quantifier: "none", operator: "contains", values: ["Beta"] },
        },
      ],
      [],
      undefined,
      undefined,
      fixtureModel
    ).filter
  ).toEqual({
    link: "accounts",
    none: { field: "name", operator: "contains", value: "Beta" },
  })
  expect(
    objectListRequest(
      Person,
      [
        {
          id: "accounts.$count",
          value: { operator: "greaterThan", values: ["2"] },
        },
      ],
      [],
      undefined,
      undefined,
      fixtureModel
    ).filter
  ).toEqual({ field: "accounts.$count", operator: "gt", value: 2 })
})

it("uses target nullability inside plural quantifiers and path nullability for singular fields", () => {
  const fields = relationshipFields(fixtureModel, Person)
  expect(
    fields.find(({ id }) => id === "accounts.name")?.property.nullable
  ).toBe(false)
  expect(
    fields.find(({ id }) => id === "accounts.domain")?.property.nullable
  ).toBe(true)
  expect(
    fields.find(({ id }) => id === "billingAccount.name")?.property.nullable
  ).toBe(true)
  for (const id of ["accounts.domain", "billingAccount.name"]) {
    const request = objectListRequest(
      Person,
      [{ id, value: { operator: "empty", values: [] } }],
      [],
      undefined,
      undefined,
      fixtureModel
    )
    expect(request.filter).toBeDefined()
    expect(() => validateQuery(fixtureModel, Person, request)).not.toThrow()
  }
})

it("uses the derived label consistently for the identity column's filtering and sorting", () => {
  const object = defineObject({
    id: "participation",
    collection: "participations",
    name: "Participation",
    pluralName: "Participations",
    properties: { name: schema.string() },
    display: { title: ["name"] },
  })
  expect(
    objectListRequest(
      object,
      [
        {
          id: object.display.title,
          value: { operator: "contains", values: ["Maya"] },
        },
      ],
      [{ id: object.display.title, desc: false }]
    )
  ).toMatchObject({
    filter: { field: "label", operator: "contains", value: "Maya" },
    sort: [{ field: "label", direction: "asc" }],
  })
})

it("filters and sorts audit fields using the existing API contract", () => {
  const request = objectListRequest(
    Account,
    [
      {
        id: "createdBy",
        value: { operator: "equals", values: ["user_author"] },
      },
      {
        id: "createdAt",
        value: { operator: "onOrAfter", values: ["2026-09-01T00:00:00.000Z"] },
      },
    ],
    [{ id: "updatedAt", desc: true }]
  )
  expect(request.filter).toEqual({
    and: [
      { field: "createdBy", operator: "eq", value: "user_author" },
      {
        field: "createdAt",
        operator: "gte",
        value: "2026-09-01T00:00:00.000Z",
      },
    ],
  })
  expect(request.sort).toEqual([
    { field: "updatedAt", direction: "desc", nulls: "last" },
  ])
  expect(() => validateQuery(fixtureModel, Account, request)).not.toThrow()
})

it("rejects unsupported resource filters and sorts instead of silently removing them", () => {
  expect(() =>
    objectListRequest(
      Account,
      [{ id: "metadata", value: { operator: "contains", values: ["import"] } }],
      []
    )
  ).toThrow("Field 'metadata' does not support filter.")
  expect(() =>
    objectListRequest(Account, [], [{ id: "etag", desc: true }])
  ).toThrow("Field 'etag' does not support sort.")
})

it("keeps indexed text search separate from column filters and list sorting", () => {
  const request = objectListRequest(
    Account,
    [{ id: "name", value: { operator: "contains", values: ["labs"] } }],
    [{ id: "name", desc: false }],
    undefined,
    undefined,
    fixtureModel,
    {},
    "  quasar  "
  )
  expect(request).toMatchObject({
    query: "quasar",
    filter: { field: "name", operator: "contains", value: "labs" },
    sort: [{ field: "name", direction: "asc" }],
  })
  expect(
    objectListRequest(
      Account,
      [],
      [],
      undefined,
      undefined,
      fixtureModel,
      {},
      "  "
    )
  ).not.toHaveProperty("query")
})
