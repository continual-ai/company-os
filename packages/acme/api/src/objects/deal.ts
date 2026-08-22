import { Root, defineObject, schema } from "@continual/runtime"

export const Deal = defineObject({
  id: "deal",
  collection: "deals",
  name: "Deal",
  parent: Root,
  pluralName: "Deals",
  description: "A potential commercial agreement with a company.",
  properties: {
    name: schema.string({
      label: "Name",
      minLength: 1,
      maxLength: 200,
    }),
    stage: schema.select({
      label: "Stage",
      default: "discovery",
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
    icon: "handshake",
    title: "name",
    status: "stage",
  },
})
