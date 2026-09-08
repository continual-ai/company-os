import { defineModuleUi } from "@company/runtime/ui/module"
import type { ObjectUi } from "@company/runtime/ui/module"

import type { Deal } from "#/model/deal.ts"
import { SalesModule } from "#/model/index.ts"
import type { Lead } from "#/model/lead.ts"
import { activityUi } from "#/ui/activity/config.ts"
import { companyUi } from "#/ui/company/config.ts"
import { contactUi } from "#/ui/contact/config.ts"
import { dealUi } from "#/ui/deal/config.ts"
import { DealToolbar } from "#/ui/deal/toolbar.tsx"
import { leadUi } from "#/ui/lead/config.ts"
import { ConvertLeadAction } from "#/ui/lead/convert-button.tsx"
import { lineItemUi } from "#/ui/line-item/config.ts"

export const SalesUi = defineModuleUi(SalesModule, {
  activity: activityUi,
  lead: {
    ...leadUi,
    actions: {
      convert: {
        component: ConvertLeadAction,
        placements: ["row", "record"],
      },
    },
  } satisfies ObjectUi<typeof Lead>,
  company: companyUi,
  contact: contactUi,
  deal: {
    ...dealUi,
    collection: {
      ...dealUi.collection,
      toolbarComponent: DealToolbar,
    },
  } satisfies ObjectUi<typeof Deal>,
  lineItem: lineItemUi,
})

export { contactViews } from "#/ui/contact/views.ts"
