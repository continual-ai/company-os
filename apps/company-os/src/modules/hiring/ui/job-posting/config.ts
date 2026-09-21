import { Model } from "#/app.model.ts"
import { JobPosting } from "#/modules/hiring/model/job-posting.ts"
import { defineCollectionView, type ObjectUi } from "#/runtime/ui/module.ts"

export const jobPostingUi = {
  collection: {
    views: [
      defineCollectionView(Model, JobPosting, "all", "All job postings", {
        columns: [
          "title",
          "status",
          "employmentType",
          "department",
          "location",
          "hiringManager",
        ],
      }),
      defineCollectionView(Model, JobPosting, "open", "Open", {
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
