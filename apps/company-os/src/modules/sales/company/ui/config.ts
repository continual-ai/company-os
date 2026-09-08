import type { ObjectUi } from "@company/ui/model/object-ui"
import { Building2Icon } from "lucide-react"

import type { Model } from "#/app.model.ts"
import { companyViews } from "#/modules/sales/company/ui/views.ts"

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
