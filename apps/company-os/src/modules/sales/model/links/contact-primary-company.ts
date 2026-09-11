import { Company } from "#/modules/sales/model/company.ts"
import { Contact } from "#/modules/sales/model/contact.ts"
import { ContactCompanies } from "#/modules/sales/model/links/contact-companies.ts"
import { defineLink } from "#/runtime/model/index.ts"

export const ContactPrimaryCompany = defineLink({
  id: "contactPrimaryCompany",
  name: "Contact primary company",
  subsetOf: ContactCompanies,
  description: "Connects a contact to their primary company.",
  from: Contact,
  to: Company,
  forward: {
    key: "primaryCompany",
    min: 0,
    max: 1,
    label: "Primary company",
    description: "The company this person mainly works with.",
  },
  reverse: {
    key: "primaryContacts",
    min: 0,
    label: "Primary contacts",
    description: "Contacts whose primary company is this company.",
  },
})
