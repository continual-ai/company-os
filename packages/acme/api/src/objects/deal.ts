import { Root, defineObject, schema } from "@continual/runtime"

import { Company } from "./company"

export const Deal = defineObject({
  id: "deal",
  collection: "deals",
  name: "Deal",
  parent: Root,
  pluralName: "Deals",
  description: "A potential commercial agreement with a company.",
  properties: {
    companyId: schema.recordId(Company, {
      label: "Company",
      required: true,
    }),
    name: schema.string({
      label: "Name",
      required: true,
      minLength: 1,
      maxLength: 200,
    }),
    stage: schema.select({
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
    amount: schema.money({
      label: "Amount",
      nullable: true,
      description: "Expected or agreed deal value.",
    }),
    expectedCloseDate: schema.date({
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
