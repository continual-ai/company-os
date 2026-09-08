import { defineLink } from "@company/runtime"

import { Company } from "#/modules/sales/company/model.ts"
import { Contact } from "#/modules/sales/contact/model.ts"

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
