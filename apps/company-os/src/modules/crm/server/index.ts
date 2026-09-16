import { CrmModule } from "#/modules/crm/model/index.ts"
import { contactSummary } from "#/modules/crm/server/contact-summary.ts"
import { defineModuleServer } from "#/runtime/server/index.ts"

export const CrmServer = defineModuleServer(CrmModule, {
  controllers: [contactSummary],
})
