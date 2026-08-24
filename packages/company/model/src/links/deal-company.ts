import { defineLink } from "@company/runtime"

import { Company } from "#objects/company"
import { Deal } from "#objects/deal"

export const DealCompany = defineLink({
  id: "dealCompany",
  name: "Deal company",
  description: "Connects a deal to the company pursuing it.",
  forward: {
    from: Deal,
    to: Company,
    key: "company",
    cardinality: "one",
    label: "Company",
    description: "The company associated with the deal.",
  },
  reverse: {
    from: Company,
    to: Deal,
    key: "deals",
    cardinality: "many",
    label: "Deals",
    description: "Deals associated with the company.",
  },
})
