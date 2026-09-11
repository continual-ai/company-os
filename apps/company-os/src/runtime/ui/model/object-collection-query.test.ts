import { describe, expect, it } from "vitest"

import { PageToken, schema } from "#/runtime/model/index.ts"
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
      pageSize: 50,
      pageToken: "account_cursor",
      sort: [{ direction: "asc", field: "name", nulls: "last" }],
    })
  })

  it("projects relationships into graph membership filters, including empty links", () => {
    expect(
      defaultFilterOperator({
        ...schema.recordId(Account),
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
          { id: "primaryAccount", value: { operator: "notEmpty", values: [] } },
        ],
        [],
        undefined,
        undefined,
        fixtureModel
      )
    ).toEqual({
      pageSize: 50,
      filter: {
        and: [
          {
            or: [
              { link: "accounts", contains: "account_a" },
              { link: "accounts", contains: "account_b" },
            ],
          },
          { not: { link: "primaryAccount", isEmpty: true } },
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
          { id: "primaryAccount", value: { operator: "empty", values: [] } },
        ],
        [],
        undefined,
        undefined,
        fixtureModel
      )
    ).toEqual({
      pageSize: 50,
      filter: {
        and: [
          { not: { or: [{ link: "accounts", contains: "account_a" }] } },
          { link: "primaryAccount", isEmpty: true },
        ],
      },
    })
  })

  it("does not invent filters for unsupported presentation values", () => {
    expect(
      objectListRequest(
        Account,
        [{ id: "logo", value: { operator: "contains", values: ["asset"] } }],
        []
      )
    ).toEqual({ pageSize: 50 })
  })
})
