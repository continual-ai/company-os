import { Party } from "./interfaces/party"
import { ContactPrimaryCompany } from "./links/contact-primary-company"
import { InteractionSubject } from "./links/interaction-subject"
import { Company } from "./objects/company"
import { Contact } from "./objects/contact"
import { Deal } from "./objects/deal"
import { Interaction } from "./objects/interaction"
import { Lead } from "./objects/lead"
import { LineItem } from "./objects/line-item"

/** Replaceable CRM definitions composed with the access definitions. */
export const crmDefinitions = {
  interfaces: [Party],
  links: [ContactPrimaryCompany, InteractionSubject],
  objects: [Company, Contact, Lead, Deal, LineItem, Interaction],
} as const
