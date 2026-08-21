import { defineLink } from "@continual/runtime"

import { Company } from "#objects/company"
import { Contact } from "#objects/contact"

export const ContactPrimaryCompany = defineLink({
  id: "contactPrimaryCompany",
  name: "Contact primary company",
  description: "Connects a contact to their primary company.",
  from: {
    type: Contact,
    name: "primaryCompany",
    cardinality: "zeroOrOne",
  },
  to: {
    type: Company,
    name: "contacts",
    cardinality: "many",
  },
})
