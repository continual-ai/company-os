import type { ObjectUi } from "@company/runtime/ui/module"
import { Building2Icon } from "lucide-react"

import type { Company } from "#/model/company.ts"
import { companyViews } from "#/ui/company/views.ts"

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
