import { defineLink } from "@continual/runtime"

import { Company } from "#objects/company"
import { Deal } from "#objects/deal"

export const DealCompany = defineLink({
  id: "dealCompany",
  name: "Deal company",
  description: "Connects a deal to the company pursuing it.",
  from: {
    type: Deal,
    key: "company",
    cardinality: "one",
    label: "Company",
    description: "The company associated with the deal.",
  },
  to: {
    type: Company,
    key: "deals",
    cardinality: "many",
    label: "Deals",
    description: "Deals associated with the company.",
  },
})
