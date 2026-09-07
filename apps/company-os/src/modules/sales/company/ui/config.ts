import type { Model } from "company-os/model"
import { Building2Icon } from "lucide-react"

import type { ObjectUi } from "@/ui/model/module-ui"

import { companyViews } from "./views"

export const companyUi = {
  navigation: {
    order: 1,
    icon: Building2Icon,
    description: "Customers, prospects, and partner organizations.",
  },
  collection: { views: companyViews },
  record: {
    properties: ["domain", "industry", "lifecycleStage", "website"],
    relationships: ["contacts", "deals", "notes"],
  },
} satisfies ObjectUi<typeof Model.objects.company>
