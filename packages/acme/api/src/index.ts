import { defineModel } from "@continual/runtime"

import { ContactPrimaryCompany } from "./links/contact-primary-company"
import { DealCompany } from "./links/deal-company"
import { Company } from "./objects/company"
import { Contact } from "./objects/contact"
import { Deal } from "./objects/deal"
import { Lead } from "./objects/lead"

export const AcmeModel = defineModel({
  id: "acme",
  name: "Acme",
  objects: [Company, Contact, Lead, Deal],
  links: [ContactPrimaryCompany, DealCompany],
})
