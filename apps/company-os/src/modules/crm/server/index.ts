import { CrmModule } from "#/modules/crm/model/index.ts"
import {
  requestBrief,
  beginBrief,
  completeBrief,
  failBrief,
} from "#/modules/crm/server/contact-brief.ts"
import { contactSummary } from "#/modules/crm/server/contact-summary.ts"
import { defineModuleServer } from "#/runtime/server/index.ts"

export const CrmServer = defineModuleServer(CrmModule, {
  operations: {
    contact: { requestBrief },
    contactBrief: {
      begin: beginBrief,
      complete: completeBrief,
      fail: failBrief,
    },
  },
  controllers: [contactSummary],
})
