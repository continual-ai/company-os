import { defineCollectionView } from "@company/runtime/ui/module"
import type { ObjectUi } from "@company/runtime/ui/module"

import type { Reply } from "#/modules/support/model/reply.ts"

export const replyUi = {
  collection: {
    views: [
      defineCollectionView("all", "All replies", {
        columns: ["subject", "ticket", "direction", "status", "sentAt"],
      }),
    ],
  },
} satisfies ObjectUi<typeof Reply>
