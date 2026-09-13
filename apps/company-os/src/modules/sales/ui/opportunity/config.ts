import { HandshakeIcon } from "lucide-react"

import type { Opportunity } from "#/modules/sales/model/opportunity.ts"
import { opportunityViews } from "#/modules/sales/ui/opportunity/views.ts"
import type { ObjectUi } from "#/runtime/ui/module.ts"

export const opportunityUi = {
  navigation: {
    order: 3,
    icon: HandshakeIcon,
    description: "Sales opportunities and next steps.",
  },
  collection: { views: opportunityViews },
} satisfies ObjectUi<typeof Opportunity>
