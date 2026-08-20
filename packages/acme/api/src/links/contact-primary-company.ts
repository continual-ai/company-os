import { defineLink } from "@continual/runtime"

import { Company } from "#objects/company"
import { Contact } from "#objects/contact"

export const ContactPrimaryCompany = defineLink({
  id: "contactPrimaryCompany",
  name: "Contact primary company",
  description: "Connects a contact to their primary company.",
  from: {
    object: Contact,
    name: "primaryCompany",
    cardinality: "zeroOrOne",
    property: "primaryCompanyId",
  },
  to: {
    object: Company,
    name: "contacts",
    cardinality: "many",
  },
})
