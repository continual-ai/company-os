import { Campaign } from "#/modules/marketing/model/campaign.ts"
import { NoteSubject } from "#/modules/notes/model/index.ts"
import { Contact } from "#/modules/sales/model/index.ts"
import { User } from "#/runtime/access/model/index.ts"
import { defineLink, defineObject, schema } from "#/runtime/model/index.ts"

export const Outreach = defineObject({
  id: "outreach",
  collection: "outreaches",
  name: "Outreach",
  pluralName: "Outreach",
  description:
    "Track a message and its delivery status. Saving does not send it.",
  implements: [{ interface: NoteSubject }],
  properties: {
    subject: schema.string({ label: "Subject", maxLength: 300, minLength: 1 }),
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
  search: { fields: ["subject", "body"] },
  display: { title: "subject", icon: "mail", status: "status" },
})

export const OutreachCampaign = defineLink({
  id: "outreachCampaign",
  name: "Outreach Campaign",
  from: Outreach,
  to: Campaign,
  forward: { key: "campaign", label: "Campaign", max: 1 },
  reverse: { key: "outreach", label: "Outreach" },
})

export const OutreachContact = defineLink({
  id: "outreachContact",
  name: "Outreach Recipient",
  from: Outreach,
  to: Contact,
  forward: { key: "contact", label: "Recipient", min: 1, max: 1 },
  reverse: { key: "outreach", label: "Outreach" },
})

export const OutreachOwner = defineLink({
  id: "outreachOwner",
  name: "Outreach Owner",
  from: Outreach,
  to: User,
  forward: { key: "owner", label: "Owner", max: 1 },
  reverse: { key: "outreach", label: "Outreach" },
})
