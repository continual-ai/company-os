import { Issue } from "#/modules/engineering/model/index.ts"
import { TicketIssues } from "#/modules/support-engineering/model/ticket-issues.ts"
import { Ticket } from "#/modules/support/model/index.ts"
import {
  defineEvent,
  defineLink,
  defineModule,
  defineObject,
  schema,
  standardErrors,
  defineAction,
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
  },
  uniqueBy: { ticket: ["ticket"] },
  actions: { create: false, update: false, delete: false, batchDelete: false },
  display: { title: "name", icon: "circleDot" },
})
export const EscalateTicket = defineAction({
  id: "escalate",
  object: Ticket,
  name: "Escalate to engineering",
  idempotent: true,
  description:
    "Creates one engineering issue for an open support ticket. Retries return the original issue.",
  input: { id: schema.id(Ticket) },
  output: { issue: schema.id(Issue) },
  errors: [
    standardErrors.failedPrecondition,
    standardErrors.aborted,
    standardErrors.alreadyExists,
  ],
})

export const EscalationTicket = defineLink({
  outputOnly: true,
  id: "escalationTicket",
  name: "Escalation Ticket",
  from: Escalation,
  to: Ticket,
  forward: { key: "ticket", label: "Ticket", min: 1, max: 1 },
  reverse: { key: "escalations", label: "Escalations" },
})

export const EscalationIssue = defineLink({
  outputOnly: true,
  id: "escalationIssue",
  name: "Escalation Issue",
  from: Escalation,
  to: Issue,
  forward: { key: "issue", label: "Issue", min: 1, max: 1 },
  reverse: { key: "escalations", label: "Escalations" },
})
export const TicketEscalated = defineEvent({
  type: "escalation.ticketEscalated",
  version: 1,
  subject: Escalation,
  data: schema.object({
    ticket: schema.id(Ticket),
    issue: schema.id(Issue),
  }),
})
export const SupportEngineeringModule = defineModule({
  maturity: "alpha",
  origin: {
    name: "Company OS",
    url: "https://github.com/continual-ai/company-os",
  },
  description: "Connect customer support tickets with engineering issues.",
  id: "supportEngineering",
  name: "Support engineering",
  links: [TicketIssues, EscalationTicket, EscalationIssue],
  objects: [Escalation],
  events: [TicketEscalated],
  actions: [EscalateTicket],
})
