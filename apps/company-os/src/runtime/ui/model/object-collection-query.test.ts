import { describe, expect, it } from "vitest"

import { PageToken } from "#/runtime/model/index.ts"
import { Account } from "#/runtime/testing/fixture-model.ts"
import { objectListRequest } from "#/runtime/ui/model/object-collection-query.ts"

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
