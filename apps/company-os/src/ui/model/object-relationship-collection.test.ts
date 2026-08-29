import { PageToken, RecordId } from "@company/runtime"
import { describe, expect, it, vi } from "vitest"

import type { DynamicLinkClient } from "./object-client"
import { loadRelationshipCollectionPage } from "./object-relationship-collection-query"

const relationshipList: DynamicLinkClient["list"] = async () => ({
  items: [
    { id: RecordId("contact")("contact_2"), objectType: "contact" },
    { id: RecordId("contact")("contact_1"), objectType: "contact" },
  ],
  nextPageToken: PageToken("next-page"),
  totalSize: 7,
})

describe("loadRelationshipCollectionPage", () => {
  it("hydrates a Link page into target records without losing page order or metadata", async () => {
    const batchGet = vi.fn(async () => ({
      items: [
        { etag: "etag-1", id: "contact_1" },
        { etag: "etag-2", id: "contact_2" },
      ],
    }))

    const page = await loadRelationshipCollectionPage({
      batchGet,
      list: relationshipList,
      objectType: "contact",
      request: { pageSize: 50 },
      sourceId: "company_1",
    })

    expect(batchGet).toHaveBeenCalledWith({
      ids: ["contact_2", "contact_1"],
    })
    expect(page.items.map(({ id }) => id)).toEqual(["contact_2", "contact_1"])
    expect(page.nextPageToken).toBe("next-page")
    expect(page.totalSize).toBe(7)
  })

  it("does not issue an invalid empty batch request", async () => {
    const batchGet = vi.fn(async () => ({ items: [] }))
    const page = await loadRelationshipCollectionPage({
      batchGet,
      list: async () => ({
        items: [],
        nextPageToken: null,
        totalSize: 0,
      }),
      objectType: "contact",
      request: { pageSize: 50 },
      sourceId: "company_1",
    })

    expect(batchGet).not.toHaveBeenCalled()
    expect(page).toEqual({
      items: [],
      nextPageToken: null,
      totalSize: 0,
    })
  })
})
