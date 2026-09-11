import { Campaign } from "#/modules/marketing/model/campaign.ts"
import { NoteSubject } from "#/modules/notes/model/index.ts"
import { Contact } from "#/modules/sales/model/index.ts"
import { defineLink, defineObject, schema } from "#/runtime/model/index.ts"

export const Enrollment = defineObject({
  id: "enrollment",
  collection: "enrollments",
  name: "Enrollment",
  pluralName: "Enrollments",
  description: "Track a contact's progress and next follow-up in a campaign.",
  implements: [{ interface: NoteSubject }],
  properties: {
    name: schema.string({ label: "Name", maxLength: 300, minLength: 1 }),
    status: schema.select({
      label: "Status",
      default: "queued",
      options: [
        { value: "queued", label: "Queued" },
        { value: "active", label: "Active" },
        { value: "paused", label: "Paused" },
        { value: "completed", label: "Completed" },
        { value: "unsubscribed", label: "Unsubscribed" },
      ],
    }),
    step: schema.number({
      label: "Current step",
      integer: true,
      minimum: 0,
      default: 0,
    }),
    nextTouchAt: schema.timestamp({ label: "Next touch", nullable: true }),
    context: schema.string({
      label: "Context",
      maxLength: 10000,
      nullable: true,
    }),
  },
  search: { fields: ["name", "context"] },
  display: { title: "name", icon: "users", status: "status" },
})

export const EnrollmentCampaign = defineLink({
  id: "enrollmentCampaign",
  name: "Enrollment Campaign",
  from: Enrollment,
  to: Campaign,
  forward: { key: "campaign", label: "Campaign", min: 1, max: 1 },
  reverse: { key: "enrollments", label: "Enrollments" },
})

export const EnrollmentContact = defineLink({
  id: "enrollmentContact",
  name: "Enrollment Contact",
  from: Enrollment,
  to: Contact,
  forward: { key: "contact", label: "Contact", min: 1, max: 1 },
  reverse: { key: "enrollments", label: "Enrollments" },
})
