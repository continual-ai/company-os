import type { ObjectUi } from "@company/runtime/ui/module"
import { UserRoundSearchIcon } from "lucide-react"

import type { Lead } from "#/model/lead.ts"
import { LeadConversion } from "#/ui/lead/conversion-tab.tsx"
import { leadViews } from "#/ui/lead/views.ts"

export const leadUi = {
  navigation: {
    order: 0,
    icon: UserRoundSearchIcon,
    description: "Potential customers to qualify and follow up with.",
  },
  collection: { views: leadViews },
  record: {
    additionalTabs: [
      { id: "conversion", label: "Conversion", component: LeadConversion },
    ],
  },
} satisfies ObjectUi<typeof Lead>
