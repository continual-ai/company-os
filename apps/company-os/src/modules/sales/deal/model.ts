import { NoteSubject } from "@company/notes/note-subject"
import { defineObject, schema } from "@company/runtime"

import { AuthorizationScope } from "#/modules/access/interfaces/authorization-scope.ts"
import { User } from "#/modules/access/user/model.ts"

export const Deal = defineObject({
  id: "deal",
  collection: "deals",
  name: "Deal",
  parent: AuthorizationScope,
  pluralName: "Deals",
  description: "A sales opportunity with its value, stage, and next steps.",
  implements: [{ interface: NoteSubject }],
  queries: {
    pipelineSummary: {
      name: "Pipeline summary",
      description:
        "Summarize deals you can view by stage and currency. Keep currencies and unpriced deals separate.",
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
    owner: schema.reference(User, {
      label: "Owner",
      nullable: true,
      inverse: { key: "deals", label: "Deals" },
    }),
    nextStep: schema.string({
      label: "Next step",
      maxLength: 5000,
      nullable: true,
    }),
    nextStepDate: schema.date({ label: "Next step due", nullable: true }),
  },
  search: { fields: ["name", "nextStep"] },
  display: {
    icon: "handshake",
    title: "name",
    status: "stage",
  },
})
