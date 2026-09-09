import { Company } from "#/modules/sales/model/company.ts"
import { Contact } from "#/modules/sales/model/contact.ts"
import { ContactCompanies } from "#/modules/sales/model/links/contact-companies.ts"
import { defineLink } from "#/runtime/model/index.ts"

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
