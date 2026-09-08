import type { ObjectUi } from "@company/ui/model/object-ui"
import { UserRoundSearchIcon } from "lucide-react"

import type { Model } from "#/app.model.ts"
import { LeadConversion } from "#/modules/sales/lead/ui/conversion-tab.tsx"
import { ConvertLeadAction } from "#/modules/sales/lead/ui/convert-button.tsx"
import { leadViews } from "#/modules/sales/lead/ui/views.ts"

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
  actions: {
    convert: { component: ConvertLeadAction, placements: ["row", "record"] },
  },
} satisfies ObjectUi<typeof Model.objects.lead>
