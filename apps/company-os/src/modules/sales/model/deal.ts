import { NoteSubject } from "#/modules/notes/model/index.ts"
import { User } from "#/runtime/access/model/index.ts"
import {
  defineLink,
  defineObject,
  schema,
  defineQuery,
} from "#/runtime/model/index.ts"

export const Deal = defineObject({
  id: "deal",
  collection: "deals",
  name: "Deal",
  pluralName: "Deals",
  description: "A sales opportunity with its value, stage, and next steps.",
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
    healthScore: schema.score({
      label: "Health score",
      nullable: true,
      description:
        "Manual assessment of opportunity health, from 0 (at risk) to 100 (strong), based on engagement, next steps, timing, and blockers.",
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
export const PipelineSummaryQuery = defineQuery({
  id: "pipelineSummary",
  collection: Deal,
  name: "Pipeline summary",
  description:
    "Summarize deals you can view by stage and currency. Keep currencies and unpriced deals separate.",
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
})

export const DealOwner = defineLink({
  id: "dealOwner",
  name: "Deal Owner",
  from: Deal,
  to: User,
  forward: { key: "owner", label: "Owner", max: 1 },
  reverse: { key: "deals", label: "Deals" },
})
