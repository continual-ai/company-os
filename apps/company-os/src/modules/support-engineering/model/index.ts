import { Issue } from "#/modules/engineering/model/index.ts"
import { TicketIssues } from "#/modules/support-engineering/model/ticket-issues.ts"
import { Ticket } from "#/modules/support/model/index.ts"
import {
  defineEvent,
  defineModule,
  defineObject,
  schema,
  standardErrors,
} from "#/runtime/model/index.ts"

export const Escalation = defineObject({
  id: "escalation",
  collection: "escalations",
  name: "Engineering escalation",
  pluralName: "Engineering escalations",
  description:
    "A support request handed to engineering, with a durable receipt for retries.",
  properties: {
    name: schema.string({ label: "Name", minLength: 1, maxLength: 400 }),
    ticket: schema.reference(Ticket, {
      label: "Ticket",
      inverse: { key: "escalations", label: "Escalations" },
    }),
    issue: schema.reference(Issue, {
      label: "Issue",
      inverse: { key: "escalations", label: "Escalations" },
    }),
  },
  uniqueBy: { ticket: ["ticket"] },
  actions: {
    create: false,
    update: false,
    delete: false,
    batchDelete: false,
    createIssue: {
      name: "Escalate to engineering",
      scope: "collection",
      idempotent: true,
      description:
        "Creates one engineering issue for an open support ticket. Retries return the original issue.",
      input: { ticket: schema.reference(Ticket) },
      output: { issue: schema.reference(Issue) },
      errors: [
        standardErrors.failedPrecondition,
        standardErrors.aborted,
        standardErrors.alreadyExists,
      ],
    },
  },
  display: { title: "name", icon: "circleDot" },
})
export const TicketEscalated = defineEvent({
  type: "escalation.ticketEscalated",
  version: 1,
  subject: Escalation,
  data: schema.object({
    ticket: schema.reference(Ticket),
    issue: schema.reference(Issue),
  }),
})
export const SupportEngineeringModule = defineModule({
  id: "supportEngineering",
  name: "Support engineering",
  links: [TicketIssues],
  objects: [Escalation],
  events: [TicketEscalated],
})
