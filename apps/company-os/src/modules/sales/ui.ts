import { activityUi } from "#/modules/sales/activity/ui/config.ts"
import { companyUi } from "#/modules/sales/company/ui/config.ts"
import { contactUi } from "#/modules/sales/contact/ui/config.ts"
import { dealUi } from "#/modules/sales/deal/ui/config.ts"
import { leadUi } from "#/modules/sales/lead/ui/config.ts"
import { lineItemUi } from "#/modules/sales/line-item/ui/config.ts"
import { SalesModule } from "#/modules/sales/model.ts"
import { defineModuleUi } from "#/ui/model/module-ui.tsx"

export const SalesUi = defineModuleUi(SalesModule, {
  activity: activityUi,
  lead: leadUi,
  company: companyUi,
  contact: contactUi,
  deal: dealUi,
  lineItem: lineItemUi,
})
