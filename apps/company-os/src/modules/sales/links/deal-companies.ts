import { defineLink } from "@company/runtime"

import { Company } from "#modules/sales/company/model"
import { Deal } from "#modules/sales/deal/model"

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
