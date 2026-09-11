import { NoteSubject } from "#/modules/notes/model/index.ts"
import { Company, Contact } from "#/modules/sales/model/index.ts"
import { User } from "#/runtime/access/model/index.ts"
import { defineLink, defineObject, schema } from "#/runtime/model/index.ts"

export const Ticket = defineObject({
  id: "ticket",
  collection: "tickets",
  name: "Ticket",
  pluralName: "Tickets",
  description: "A customer request or problem to investigate and resolve.",
  implements: [{ interface: NoteSubject }],
  properties: {
    subject: schema.string({ label: "Subject", maxLength: 300, minLength: 1 }),
    description: schema.string({
      label: "Description",
      maxLength: 50000,
      nullable: true,
    }),
    priority: schema.select({
      label: "Priority",
      default: "normal",
      options: [
        { value: "normal", label: "Normal" },
        { value: "low", label: "Low" },
        { value: "high", label: "High" },
        { value: "urgent", label: "Urgent" },
      ],
    }),
    status: schema.select({
      label: "Status",
      default: "new",
      options: [
        { value: "new", label: "New" },
        { value: "open", label: "Open" },
        { value: "waitingOnCustomer", label: "Waiting on customer" },
        { value: "waitingOnTeam", label: "Waiting on team" },
        { value: "resolved", label: "Resolved" },
        { value: "closed", label: "Closed" },
      ],
    }),
    respondByAt: schema.timestamp({ label: "Respond by", nullable: true }),
    resolution: schema.string({
      label: "Resolution",
      maxLength: 20000,
      nullable: true,
    }),
    externalId: schema.string({
      label: "Source ticket ID",
      maxLength: 300,
      nullable: true,
    }),
  },
  search: { fields: ["subject", "description", "resolution", "externalId"] },
  display: { title: "subject", icon: "messageSquare", status: "status" },
})

export const TicketCompany = defineLink({
  id: "ticketCompany",
  name: "Ticket Company",
  from: Ticket,
  to: Company,
  forward: { key: "company", label: "Company", max: 1 },
  reverse: { key: "tickets", label: "Tickets" },
})

export const TicketRequester = defineLink({
  id: "ticketRequester",
  name: "Ticket Requester",
  from: Ticket,
  to: Contact,
  forward: { key: "requester", label: "Requester", max: 1 },
  reverse: { key: "tickets", label: "Tickets" },
})

export const TicketOwner = defineLink({
  id: "ticketOwner",
  name: "Ticket Owner",
  from: Ticket,
  to: User,
  forward: { key: "owner", label: "Owner", max: 1 },
  reverse: { key: "tickets", label: "Tickets" },
})
