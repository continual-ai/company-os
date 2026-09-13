import { Building2Icon } from "lucide-react"

import type { Account } from "#/modules/crm/model/account.ts"
import { accountViews } from "#/modules/crm/ui/account/views.ts"
import type { ObjectUi } from "#/runtime/ui/module.ts"

export const accountUi = {
  navigation: {
    order: 1,
    icon: Building2Icon,
    description: "Customers, prospects, and partner organizations.",
  },
  collection: { views: accountViews },
  record: {
    properties: ["domain", "industry", "fitScore", "lifecycleStage", "website"],
  },
} satisfies ObjectUi<typeof Account>
