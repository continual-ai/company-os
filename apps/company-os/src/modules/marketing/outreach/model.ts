import { defineObject, schema } from "@company/runtime"

import { User } from "#modules/access/user/model"
import { Campaign } from "#modules/marketing/campaign/model"
import { Contact } from "#modules/sales/contact/model"
import { NoteSubject } from "#modules/sales/interfaces/note-subject"
import { Root } from "#root"

export const Outreach = defineObject({
  id: "outreach",
  collection: "outreaches",
  name: "Outreach",
  pluralName: "Outreach",
  description:
    "An individual outbound message and its delivery outcome. Sending requires an integration; queued records are not delivery receipts.",
  parent: Root,
  implements: [{ interface: NoteSubject }],
  properties: {
    subject: schema.string({ label: "Subject", maxLength: 300, minLength: 1 }),
    campaign: schema.reference(Campaign, {
      label: "Campaign",
      nullable: true,
      inverse: { key: "outreach", label: "Outreach" },
    }),
    contact: schema.reference(Contact, {
      label: "Recipient",
      inverse: { key: "outreach", label: "Outreach" },
    }),
    channel: schema.select({
      label: "Channel",
      default: "email",
      options: [
        { value: "email", label: "Email" },
        { value: "social", label: "Social" },
        { value: "phone", label: "Phone" },
      ],
    }),
    status: schema.select({
      label: "Status",
      default: "draft",
      options: [
        { value: "draft", label: "Draft" },
        { value: "review", label: "In review" },
        { value: "queued", label: "Queued" },
        { value: "sent", label: "Sent" },
        { value: "replied", label: "Replied" },
        { value: "failed", label: "Failed" },
        { value: "canceled", label: "Canceled" },
      ],
    }),
    owner: schema.reference(User, {
      label: "Owner",
      nullable: true,
      inverse: { key: "outreach", label: "Outreach" },
    }),
    body: schema.string({ label: "Message", maxLength: 50000, nullable: true }),
    scheduledAt: schema.timestamp({ label: "Scheduled for", nullable: true }),
    sentAt: schema.timestamp({ label: "Sent at", nullable: true }),
    externalId: schema.string({
      label: "Provider message ID",
      maxLength: 300,
      nullable: true,
    }),
    failure: schema.string({
      label: "Failure detail",
      maxLength: 5000,
      nullable: true,
    }),
  },
  display: { title: "subject", icon: "mail", status: "status" },
})
