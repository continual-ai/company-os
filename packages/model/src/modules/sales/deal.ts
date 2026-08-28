import { defineObject, schema } from "@company/runtime"

import { Company } from "./company"
import { NoteSubject } from "./note-subject"

export const Deal = defineObject({
  id: "deal",
  collection: "deals",
  name: "Deal",
  parent: Company,
  pluralName: "Deals",
  description: "A potential commercial agreement with a company.",
  implements: [{ interface: NoteSubject }],
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
