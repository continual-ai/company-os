import { SalesModule } from "#/modules/sales/model/index.ts"
import type { Lead } from "#/modules/sales/model/lead.ts"
import type { Opportunity } from "#/modules/sales/model/opportunity.ts"
import { leadUi } from "#/modules/sales/ui/lead/config.ts"
import { ConvertLeadAction } from "#/modules/sales/ui/lead/convert-button.tsx"
import { lineItemUi } from "#/modules/sales/ui/line-item/config.ts"
import { opportunityUi } from "#/modules/sales/ui/opportunity/config.ts"
import { OpportunityToolbar } from "#/modules/sales/ui/opportunity/toolbar.tsx"
import { defineModuleUi, type ObjectUi } from "#/runtime/ui/module.ts"

export const SalesUi = defineModuleUi(SalesModule, {
  lead: {
    ...leadUi,
    actions: {
      convert: {
        component: ConvertLeadAction,
        placements: ["row", "record"],
      },
    },
  } satisfies ObjectUi<typeof Lead>,
  opportunity: {
    ...opportunityUi,
    collection: {
      ...opportunityUi.collection,
      toolbarComponent: OpportunityToolbar,
    },
  } satisfies ObjectUi<typeof Opportunity>,
  lineItem: lineItemUi,
})
