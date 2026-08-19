import { defineObject, field } from "@continual/runtime"

import { Company } from "./company"

export const Deal = defineObject({
  id: "deal",
  collection: "deals",
  name: "Deal",
  pluralName: "Deals",
  description: "A potential commercial agreement with a company.",
  fields: {
    companyId: field.reference({
      object: Company,
      label: "Company",
      required: true,
    }),
    name: field.text({
      label: "Name",
      required: true,
      minLength: 1,
      maxLength: 200,
    }),
    stage: field.select({
      label: "Stage",
      defaultValue: "discovery",
      options: [
        { value: "discovery", label: "Discovery" },
        { value: "qualified", label: "Qualified" },
        { value: "proposal", label: "Proposal" },
        { value: "negotiation", label: "Negotiation" },
        { value: "won", label: "Won" },
        { value: "lost", label: "Lost" },
      ],
    }),
    amount: field.money({
      label: "Amount",
      nullable: true,
      description: "Expected or agreed deal value.",
    }),
    expectedCloseDate: field.date({
      label: "Expected close date",
      nullable: true,
    }),
  },
  display: {
    title: "name",
    subtitle: "companyId",
    status: "stage",
  },
})
