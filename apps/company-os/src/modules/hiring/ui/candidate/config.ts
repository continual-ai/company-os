import type { Candidate } from "#/modules/hiring/model/candidate.ts"
import { defineCollectionView } from "#/runtime/ui/module.ts"
import type { ObjectUi } from "#/runtime/ui/module.ts"

export const candidateUi = {
  collection: {
    views: [
      defineCollectionView("all", "All candidates", {
        columns: ["name", "email", "phone", "linkedinUrl", "portfolioUrl"],
      }),
    ],
  },
} satisfies ObjectUi<typeof Candidate>
