import type { Reply } from "#/modules/support/model/reply.ts"
import { defineCollectionView } from "#/runtime/ui/module.ts"
import type { ObjectUi } from "#/runtime/ui/module.ts"

export const replyUi = {
  collection: {
    views: [
      defineCollectionView("all", "All replies", {
        columns: ["subject", "ticket", "direction", "status", "sentAt"],
      }),
    ],
  },
} satisfies ObjectUi<typeof Reply>
