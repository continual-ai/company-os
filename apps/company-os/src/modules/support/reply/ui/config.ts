import type { Model } from "company-os/model"

import type { ObjectUi } from "@/ui/model/module-ui"
import { defineCollectionView } from "@/ui/model/object-collection-view"

export const replyUi = {
  collection: {
    views: [
      defineCollectionView("all", "All replies", {
        columns: ["subject", "ticket", "direction", "status", "sentAt"],
        sorting: [{ id: "subject", desc: false }],
      }),
    ],
  },
} satisfies ObjectUi<typeof Model.objects.reply>
