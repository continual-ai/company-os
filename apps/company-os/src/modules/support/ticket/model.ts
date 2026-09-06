import { defineObject, schema } from "@company/runtime"

import { User } from "#modules/access/user/model"
import { Company } from "#modules/sales/company/model"
import { Contact } from "#modules/sales/contact/model"
import { NoteSubject } from "#modules/sales/interfaces/note-subject"
import { Root } from "#root"

export const Ticket = defineObject({
  id: "ticket",
  collection: "tickets",
  name: "Ticket",
  pluralName: "Tickets",
  description:
    "A customer problem with a responsible owner, response deadline, and durable resolution.",
  parent: Root,
  implements: [{ interface: NoteSubject }],
  properties: {
    subject: schema.string({ label: "Subject", maxLength: 300, minLength: 1 }),
    description: schema.string({
      label: "Description",
      maxLength: 50000,
      nullable: true,
    }),
    company: schema.reference(Company, {
      label: "Company",
      nullable: true,
      inverse: { key: "tickets", label: "Tickets" },
    }),
    requester: schema.reference(Contact, {
      label: "Requester",
      nullable: true,
      inverse: { key: "tickets", label: "Tickets" },
    }),
    owner: schema.reference(User, {
      label: "Owner",
      nullable: true,
      inverse: { key: "tickets", label: "Tickets" },
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
