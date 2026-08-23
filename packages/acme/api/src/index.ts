import { defineModel } from "@continual/runtime"

import { Party } from "./interfaces/party"
import { ContactPrimaryCompany } from "./links/contact-primary-company"
import { DealCompany } from "./links/deal-company"
import { InteractionSubject } from "./links/interaction-subject"
import { Company } from "./objects/company"
import { Contact } from "./objects/contact"
import { Deal } from "./objects/deal"
import { Interaction } from "./objects/interaction"
import { Lead } from "./objects/lead"
import { LineItem } from "./objects/line-item"
import { Platform } from "./platform"

export const AcmeModel = defineModel({
  id: "acme",
  name: "Acme",
  interfaces: [Party],
  objects: [Company, Contact, Lead, Deal, LineItem, Interaction],
  links: [ContactPrimaryCompany, DealCompany, InteractionSubject],
  root: Platform,
})
