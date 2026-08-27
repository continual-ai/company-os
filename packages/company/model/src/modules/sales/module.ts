import { defineModule } from "@company/runtime"

import { Company } from "./company"
import { Contact } from "./contact"
import { ContactPrimaryCompany } from "./contact-primary-company"
import { Deal } from "./deal"
import { Interaction } from "./interaction"
import { InteractionRegarding } from "./interaction-regarding"
import { Lead } from "./lead"
import { LineItem } from "./line-item"
import { Party } from "./party"

export const SalesModule = defineModule({
  id: "sales",
  name: "Sales",
  interfaces: [Party],
  links: [ContactPrimaryCompany, InteractionRegarding],
  objects: [Company, Contact, Lead, Deal, LineItem, Interaction],
})
