import { describe, expect, it } from "vitest"

import { Model } from "#/app.model.ts"
import { PageToken } from "#/runtime/model/index.ts"
import { objectListRequest } from "#/runtime/ui/model/object-collection-query.ts"

describe("object collection queries", () => {
  it("projects table filters and sorting into the portable list contract", () => {
    expect(
      objectListRequest(
        Model.objects.company,
        [
          {
            id: "name",
            value: { operator: "contains", values: ["north"] },
          },
          {
            id: "lifecycleStage",
            value: { operator: "notEquals", values: ["inactive"] },
          },
        ],
        [{ desc: false, id: "name" }],
        PageToken("company_cursor")
      )
    ).toEqual({
      filter: {
        and: [
          { field: "name", operator: "contains", value: "north" },
          {
            not: {
              field: "lifecycleStage",
              operator: "eq",
              value: "inactive",
            },
          },
        ],
      },
      pageSize: 50,
      pageToken: "company_cursor",
      sort: [{ direction: "asc", field: "name", nulls: "last" }],
    })
  })

  it("does not invent filters for unsupported presentation values", () => {
    expect(
      objectListRequest(
        Model.objects.company,
        [{ id: "logo", value: { operator: "contains", values: ["asset"] } }],
        []
      )
    ).toEqual({ pageSize: 50 })
  })
})
