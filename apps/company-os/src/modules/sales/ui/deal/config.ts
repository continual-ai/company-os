import { HandshakeIcon } from "lucide-react"

import type { Deal } from "#/modules/sales/model/deal.ts"
import { dealViews } from "#/modules/sales/ui/deal/views.ts"
import type { ObjectUi } from "#/runtime/ui/module.ts"

export const dealUi = {
  navigation: {
    order: 3,
    icon: HandshakeIcon,
    description: "Sales opportunities and next steps.",
  },
  collection: { views: dealViews },
} satisfies ObjectUi<typeof Deal>
