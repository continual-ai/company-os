import { defineCollectionView } from "@company/ui/model/collection-view"
import type { ObjectUi } from "@company/ui/model/object-ui"

import type { Model } from "#/app.model.ts"

export const replyUi = {
  collection: {
    views: [
      defineCollectionView("all", "All replies", {
        columns: ["subject", "ticket", "direction", "status", "sentAt"],
      }),
    ],
  },
} satisfies ObjectUi<typeof Model.objects.reply>
