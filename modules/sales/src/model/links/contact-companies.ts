import { defineLink } from "@company/runtime/model"

import { Company } from "#/model/company.ts"
import { Contact } from "#/model/contact.ts"

export const ContactCompanies = defineLink({
  id: "contactCompanies",
  name: "Contact companies",
  writeFrom: "contacts",
  forward: {
    from: Contact,
    to: Company,
    key: "companies",
    cardinality: "many",
    label: "Companies",
  },
  reverse: {
    from: Company,
    to: Contact,
    key: "contacts",
    cardinality: "many",
    label: "Contacts",
  },
})
