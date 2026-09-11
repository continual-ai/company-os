import { Company } from "#/modules/sales/model/company.ts"
import { Deal } from "#/modules/sales/model/deal.ts"
import { defineLink } from "#/runtime/model/index.ts"

export const DealCompanies = defineLink({
  id: "dealCompanies",
  name: "Deal companies",
  from: Deal,
  to: Company,
  forward: {
    key: "companies",
    min: 0,
    label: "Companies",
  },
  reverse: {
    key: "deals",
    min: 0,
    label: "Deals",
  },
})
