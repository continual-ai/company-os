import { Model } from "#/app.model.ts"
import { Affiliation } from "#/modules/crm/model/affiliation.ts"
import { defineCollectionView, type ObjectUi } from "#/runtime/ui/module.ts"

export const affiliationUi = {
  collection: {
    views: [
      defineCollectionView(Model, Affiliation, "all", "All affiliations", {
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
