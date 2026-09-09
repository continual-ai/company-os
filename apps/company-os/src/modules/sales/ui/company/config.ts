import { Building2Icon } from "lucide-react"

import type { Company } from "#/modules/sales/model/company.ts"
import { companyViews } from "#/modules/sales/ui/company/views.ts"
import type { ObjectUi } from "#/runtime/ui/module.ts"

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
} satisfies ObjectUi<typeof Company>
