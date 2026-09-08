import { defineLink } from "@company/runtime/model"

import { Company } from "#/model/company.ts"
import { Deal } from "#/model/deal.ts"

export const DealCompanies = defineLink({
  id: "dealCompanies",
  name: "Deal companies",
  writeFrom: "companies",
  forward: {
    from: Deal,
    to: Company,
    key: "companies",
    cardinality: "many",
    label: "Companies",
  },
  reverse: {
    from: Company,
    to: Deal,
    key: "deals",
    cardinality: "many",
    label: "Deals",
  },
})
