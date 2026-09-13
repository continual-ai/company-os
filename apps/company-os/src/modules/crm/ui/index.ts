import { CrmModule } from "#/modules/crm/model/index.ts"
import { accountUi } from "#/modules/crm/ui/account/config.ts"
import { activityUi } from "#/modules/crm/ui/activity/config.ts"
import { affiliationUi } from "#/modules/crm/ui/affiliation/config.ts"
import { contactUi } from "#/modules/crm/ui/contact/config.ts"
import { defineModuleUi } from "#/runtime/ui/module.ts"

export const CrmUi = defineModuleUi(CrmModule, {
  account: accountUi,
  affiliation: affiliationUi,
  contact: contactUi,
  activity: activityUi,
})
