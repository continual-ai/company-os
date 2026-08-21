import { defineLink } from "@continual/runtime"

import { Company } from "#objects/company"
import { Deal } from "#objects/deal"

export const DealCompany = defineLink({
  id: "dealCompany",
  name: "Deal company",
  description: "Connects a deal to the company pursuing it.",
  from: {
    type: Deal,
    name: "company",
    cardinality: "one",
  },
  to: {
    type: Company,
    name: "deals",
    cardinality: "many",
  },
})
