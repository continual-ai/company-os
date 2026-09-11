import { Company } from "#/modules/sales/model/company.ts"
import { Contact } from "#/modules/sales/model/contact.ts"
import { defineLink } from "#/runtime/model/index.ts"

export const ContactCompanies = defineLink({
  id: "contactCompanies",
  name: "Contact companies",
  from: Contact,
  to: Company,
  forward: {
    key: "companies",
    min: 0,
    label: "Companies",
  },
  reverse: {
    key: "contacts",
    min: 0,
    label: "Contacts",
  },
})
