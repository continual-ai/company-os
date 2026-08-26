import { ContactPrimaryCompany } from "./links/contact-primary-company"
import { InteractionSubject } from "./links/interaction-subject"
import { Company } from "./objects/company"
import { Contact } from "./objects/contact"
import { Deal } from "./objects/deal"
import { Interaction } from "./objects/interaction"
import { Lead } from "./objects/lead"
import { LineItem } from "./objects/line-item"

/** The replaceable business model composed on top of the Company OS foundation. */
export const companyComposition = {
  links: [ContactPrimaryCompany, InteractionSubject],
  objects: [Company, Contact, Lead, Deal, LineItem, Interaction],
} as const
