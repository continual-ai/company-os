import { defineLink } from "@company/runtime"

import { Company } from "#modules/sales/company/model"
import { Contact } from "#modules/sales/contact/model"

import { ContactCompanies } from "./contact-companies"

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
    description: "The contact's primary company.",
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
