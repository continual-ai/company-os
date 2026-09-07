import type { Model } from "company-os/model"
import { UserRoundSearchIcon } from "lucide-react"

import type { ObjectUi } from "@/ui/model/module-ui"

import { LeadConversion } from "./conversion-tab"
import { ConvertLeadAction } from "./convert-button"
import { leadViews } from "./views"

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
