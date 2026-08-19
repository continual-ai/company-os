import { defineModule } from "@continual/runtime"

import { Company } from "./company"
import { Contact } from "./contact"
import { Deal } from "./deal"
import { Lead } from "./lead"
import { QualifyLead } from "./qualify-lead"

export const CRM = defineModule({
  id: "crm",
  name: "CRM",
  objects: [Company, Contact, Lead, Deal],
  actions: [QualifyLead],
})
