import type { ObjectUi } from "@company/runtime/ui/module"
import { HandshakeIcon } from "lucide-react"

import type { Deal } from "#/model/deal.ts"
import { dealViews } from "#/ui/deal/views.ts"

export const dealUi = {
  navigation: {
    order: 3,
    icon: HandshakeIcon,
    description: "Sales opportunities and next steps.",
  },
  collection: { views: dealViews },
} satisfies ObjectUi<typeof Deal>
