import { Model } from "#/app.model.ts"
import { Candidate } from "#/modules/hiring/model/candidate.ts"
import { defineCollectionView, type ObjectUi } from "#/runtime/ui/module.ts"

export const candidateUi = {
  collection: {
    views: [
      defineCollectionView(Model, Candidate, "all", "All candidates", {
        columns: ["name", "email", "phone", "linkedinUrl", "portfolioUrl"],
      }),
    ],
  },
} satisfies ObjectUi<typeof Candidate>
