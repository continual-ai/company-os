import { Company } from "#/modules/sales/model/company.ts"
import { Deal } from "#/modules/sales/model/deal.ts"
import { defineLink } from "#/runtime/model/index.ts"

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
