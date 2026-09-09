import { Company } from "#/modules/sales/model/company.ts"
import { Contact } from "#/modules/sales/model/contact.ts"
import { defineLink } from "#/runtime/model/index.ts"

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
