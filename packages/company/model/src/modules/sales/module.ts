import { defineModule } from "@company/runtime"

import { Company } from "./company"
import { Contact } from "./contact"
import { ContactPrimaryCompany } from "./contact-primary-company"
import { Deal } from "./deal"
import { Interaction } from "./interaction"
import { InteractionSubject } from "./interaction-subject"
import { Lead } from "./lead"
import { LineItem } from "./line-item"
import { Party } from "./party"

export const SalesModule = defineModule({
  id: "sales",
  name: "Sales",
  interfaces: [Party],
  links: [ContactPrimaryCompany, InteractionSubject],
  objects: [Company, Contact, Lead, Deal, LineItem, Interaction],
})
