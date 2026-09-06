import { defineModuleUi } from "@/ui/model/module-ui"

import { companyUi } from "./company/ui/config"
import { contactUi } from "./contact/ui/config"
import { dealUi } from "./deal/ui/config"
import { leadUi } from "./lead/ui/config"
import { lineItemUi } from "./line-item/ui/config"
import { SalesModule } from "./model"
import { noteUi } from "./note/ui/config"

export const SalesUi = defineModuleUi(SalesModule, {
  lead: leadUi,
  company: companyUi,
  contact: contactUi,
  deal: dealUi,
  note: noteUi,
  lineItem: lineItemUi,
})
