import type { Model } from "company-os/model"
import { UserRoundSearchIcon } from "lucide-react"

import type { ObjectUi } from "@/ui/model/module-ui"

import { LeadConversion } from "./conversion-tab"
import { ConvertLeadAction } from "./convert-button"
import { leadViews } from "./views"

export const leadUi = {
  navigation: {
    path: "/leads",
    order: 0,
    icon: UserRoundSearchIcon,
    description: "Qualify new interest and convert it into customer records.",
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
