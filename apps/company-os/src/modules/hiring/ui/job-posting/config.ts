import type { JobPosting } from "#/modules/hiring/model/job-posting.ts"
import { defineCollectionView } from "#/runtime/ui/module.ts"
import type { ObjectUi } from "#/runtime/ui/module.ts"

export const jobPostingUi = {
  collection: {
    views: [
      defineCollectionView("all", "All job postings", {
        columns: [
          "title",
          "status",
          "employmentType",
          "department",
          "location",
          "hiringManager",
        ],
      }),
      defineCollectionView("open", "Open", {
        columns: [
          "title",
          "employmentType",
          "department",
          "location",
          "hiringManager",
        ],
        filters: [
          { id: "status", value: { operator: "equals", values: ["open"] } },
        ],
      }),
    ],
  },
} satisfies ObjectUi<typeof JobPosting>
