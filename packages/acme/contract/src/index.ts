import { defineCompany } from "@continual/runtime"

import { CRM } from "./modules/crm/crm"

export { Contact } from "./modules/crm/contact"
export { CRM } from "./modules/crm/crm"
export { Customer } from "./modules/crm/customer"
export { Project } from "./modules/crm/project"

export const Acme = defineCompany({
  id: "acme",
  name: "Acme",
  modules: [CRM],
})
