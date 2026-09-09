import type { Deal } from "#/modules/sales/model/deal.ts"
import { SalesModule } from "#/modules/sales/model/index.ts"
import type { Lead } from "#/modules/sales/model/lead.ts"
import { activityUi } from "#/modules/sales/ui/activity/config.ts"
import { companyUi } from "#/modules/sales/ui/company/config.ts"
import { contactUi } from "#/modules/sales/ui/contact/config.ts"
import { dealUi } from "#/modules/sales/ui/deal/config.ts"
import { DealToolbar } from "#/modules/sales/ui/deal/toolbar.tsx"
import { leadUi } from "#/modules/sales/ui/lead/config.ts"
import { ConvertLeadAction } from "#/modules/sales/ui/lead/convert-button.tsx"
import { lineItemUi } from "#/modules/sales/ui/line-item/config.ts"
import { defineModuleUi } from "#/runtime/ui/module.ts"
import type { ObjectUi } from "#/runtime/ui/module.ts"

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

export { contactViews } from "#/modules/sales/ui/contact/views.ts"
