import { defineCompany } from "@continual/runtime"

import { CRM } from "./modules/crm/crm"

export { Company } from "./modules/crm/company"
export { Contact } from "./modules/crm/contact"
export { CRM } from "./modules/crm/crm"
export { Deal } from "./modules/crm/deal"
export { Lead } from "./modules/crm/lead"
export { QualifyLead } from "./modules/crm/qualify-lead"

export const AcmeApi = defineCompany({
  id: "acme",
  name: "Acme",
  modules: [CRM],
})
