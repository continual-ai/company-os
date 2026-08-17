import { defineModule } from "@continual/model"

import { Contact } from "./contact"
import { Customer } from "./customer"
import { Project } from "./project"

export { Contact, Customer, Project }

export const CRM = defineModule({
  id: "crm",
  name: "CRM",
  objects: [Customer, Contact, Project],
})
