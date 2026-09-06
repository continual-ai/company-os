import { defineObject, schema } from "@company/runtime"

import { AuthorizationScope } from "#modules/access/interfaces/authorization-scope"
import { NoteSubject } from "#modules/sales/interfaces/note-subject"

export const Deal = defineObject({
  id: "deal",
  collection: "deals",
  name: "Deal",
  parent: AuthorizationScope,
  pluralName: "Deals",
  description:
    "A potential commercial agreement involving one or more companies.",
  implements: [{ interface: NoteSubject }],
  queries: {
    pipelineSummary: {
      name: "Pipeline summary",
      description:
        "Counts readable deals by stage and currency. Amounts in different currencies are never combined; unpriced deals form a separate group.",
      scope: "collection",
      output: {
        groups: schema.array(
          schema.object({
            stage: schema.string(),
            currency: schema.string({ nullable: true }),
            count: schema.number({ integer: true, minimum: 0 }),
            amount: schema.decimal({ nullable: true }),
          })
        ),
      },
    },
  },
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
