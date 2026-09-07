import { defineObject, schema } from "@company/runtime"

import { NoteSubject } from "#modules/sales/interfaces/note-subject"
import { Ticket } from "#modules/support/ticket/model"
import { Root } from "#root"

export const Reply = defineObject({
  id: "reply",
  collection: "replies",
  name: "Reply",
  pluralName: "Replies",
  description: "A message about a support ticket. Saving does not send it.",
  parent: Root,
  implements: [{ interface: NoteSubject }],
  properties: {
    subject: schema.string({ label: "Subject", maxLength: 300, minLength: 1 }),
    ticket: schema.reference(Ticket, {
      label: "Ticket",
      inverse: { key: "replies", label: "Replies" },
    }),
    direction: schema.select({
      label: "Direction",
      default: "inbound",
      options: [
        { value: "inbound", label: "Inbound" },
        { value: "outbound", label: "Outbound" },
        { value: "internal", label: "Internal note" },
      ],
    }),
    status: schema.select({
      label: "Status",
      default: "draft",
      options: [
        { value: "draft", label: "Draft" },
        { value: "received", label: "Received" },
        { value: "queued", label: "Queued" },
        { value: "sent", label: "Sent" },
        { value: "failed", label: "Failed" },
      ],
    }),
    body: schema.string({ label: "Body", maxLength: 50000, minLength: 1 }),
    externalId: schema.string({
      label: "Provider message ID",
      maxLength: 300,
      nullable: true,
    }),
    sentAt: schema.timestamp({ label: "Sent at", nullable: true }),
    attachments: schema.array(schema.file({ maxBytes: 25_000_000 }), {
      label: "Attachments",
      default: [],
    }),
  },
  search: { fields: ["subject", "body", "externalId"] },
  display: { title: "subject", icon: "mail", status: "status" },
})
