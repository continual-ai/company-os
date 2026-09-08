import { defineLink } from "@company/runtime"

import { Company } from "#/modules/sales/company/model.ts"
import { Contact } from "#/modules/sales/contact/model.ts"
import { ContactCompanies } from "#/modules/sales/links/contact-companies.ts"

export const ContactPrimaryCompany = defineLink({
  id: "contactPrimaryCompany",
  name: "Contact primary company",
  writeFrom: "primaryCompany",
  subsetOf: ContactCompanies,
  description: "Connects a contact to their primary company.",
  forward: {
    from: Contact,
    to: Company,
    key: "primaryCompany",
    cardinality: "zeroOrOne",
    label: "Primary company",
    description: "The company this person mainly works with.",
  },
  reverse: {
    from: Company,
    to: Contact,
    key: "primaryContacts",
    cardinality: "many",
    label: "Primary contacts",
    description: "Contacts whose primary company is this company.",
  },
})
