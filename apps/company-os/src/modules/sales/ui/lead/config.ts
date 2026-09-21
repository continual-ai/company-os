import { UserRoundSearchIcon } from "lucide-react"

import type { Lead } from "#/modules/sales/model/lead.ts"
import { leadViews } from "#/modules/sales/ui/lead/views.ts"
import type { ObjectUi } from "#/runtime/ui/module.ts"

export const leadUi = {
  navigation: {
    order: 0,
    icon: UserRoundSearchIcon,
    description: "Potential customers to qualify and follow up with.",
  },
  collection: { views: leadViews },
  record: { links: ["account", "contact", "opportunity", "notes"] },
} satisfies ObjectUi<typeof Lead>
