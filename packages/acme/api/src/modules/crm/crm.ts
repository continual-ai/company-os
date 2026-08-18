import { defineModule } from "@continual/runtime"

import { Contact } from "./contact"
import { Customer } from "./customer"
import { Project } from "./project"

export const CRM = defineModule({
  id: "crm",
  name: "CRM",
  objects: [Customer, Contact, Project],
})
