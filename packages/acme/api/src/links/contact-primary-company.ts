import { defineLink } from "@continual/runtime"

import { Company } from "#objects/company"
import { Contact } from "#objects/contact"

export const ContactPrimaryCompany = defineLink({
  id: "contactPrimaryCompany",
  name: "Contact primary company",
  description: "Connects a contact to their primary company.",
  forward: {
    from: Contact,
    to: Company,
    key: "primaryCompany",
    cardinality: "zeroOrOne",
    label: "Primary company",
    description: "The contact's primary company.",
  },
  reverse: {
    from: Company,
    to: Contact,
    key: "contacts",
    cardinality: "many",
    label: "Contacts",
    description: "Contacts whose primary company is this company.",
  },
})
