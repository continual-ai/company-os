import { defineLink } from "@continual/runtime"

import { Company } from "#objects/company"
import { Contact } from "#objects/contact"

export const ContactPrimaryCompany = defineLink({
  id: "contactPrimaryCompany",
  name: "Contact primary company",
  description: "Connects a contact to their primary company.",
  from: {
    type: Contact,
    key: "primaryCompany",
    cardinality: "zeroOrOne",
    label: "Primary company",
    description: "The contact's primary company.",
  },
  to: {
    type: Company,
    key: "contacts",
    cardinality: "many",
    label: "Contacts",
    description: "Contacts whose primary company is this company.",
  },
})
