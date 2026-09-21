import { Model } from "#/app.model.ts"
import { Reply } from "#/modules/service/model/reply.ts"
import { defineCollectionView, type ObjectUi } from "#/runtime/ui/module.ts"

export const replyUi = {
  collection: {
    views: [
      defineCollectionView(Model, Reply, "all", "All replies", {
        columns: ["subject", "ticket", "direction", "status", "sentAt"],
      }),
    ],
  },
} satisfies ObjectUi<typeof Reply>
