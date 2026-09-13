import type { Affiliation } from "#/modules/crm/model/affiliation.ts"
import { defineCollectionView, type ObjectUi } from "#/runtime/ui/module.ts"

export const affiliationUi = {
  collection: {
    views: [
      defineCollectionView("all", "All affiliations", {
        columns: [
          "label",
          "contact",
          "account",
          "jobTitle",
          "startDate",
          "endDate",
        ],
      }),
    ],
  },
} satisfies ObjectUi<typeof Affiliation>
