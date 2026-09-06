import { PageToken, RecordId } from "@company/runtime"
import { Effect } from "effect"
import { describe, expect, it } from "vitest"

import type { DynamicLinkClient } from "./object-client"
import { loadRelationshipCollectionPage } from "./object-relationship-collection-query"

const relationshipList: DynamicLinkClient["list"] = () =>
  Effect.succeed({
    items: [
      {
        id: RecordId("contact")("contact_2"),
        objectType: "contact",
        etag: "version",
      },
      {
        id: RecordId("contact")("contact_1"),
        objectType: "contact",
        etag: "version",
      },
    ],
    nextPageToken: PageToken("next-page"),
    totalSize: 7,
  })

describe("loadRelationshipCollectionPage", () => {
  it("uses the complete relationship page without losing order or metadata", async () => {
    const page = await Effect.runPromise(
      loadRelationshipCollectionPage({
        list: relationshipList,
        objectType: "contact",
        request: { pageSize: 50 },
        sourceId: "company_1",
      })
    )

    expect(page.items.map(({ id }) => id)).toEqual(["contact_2", "contact_1"])
    expect(page.nextPageToken).toBe("next-page")
    expect(page.totalSize).toBe(7)
  })

  it("does not issue an invalid empty batch request", async () => {
    const page = await Effect.runPromise(
      loadRelationshipCollectionPage({
        list: () =>
          Effect.succeed({
            items: [],
            nextPageToken: null,
            totalSize: 0,
          }),
        objectType: "contact",
        request: { pageSize: 50 },
        sourceId: "company_1",
      })
    )

    expect(page).toEqual({
      items: [],
      nextPageToken: null,
      totalSize: 0,
    })
  })
})
