import { Campaign } from "#/modules/marketing/model/campaign.ts"
import { NoteSubject } from "#/modules/notes/model/index.ts"
import { Contact } from "#/modules/sales/model/index.ts"
import { defineObject, schema } from "#/runtime/model/index.ts"

export const Enrollment = defineObject({
  id: "enrollment",
  collection: "enrollments",
  name: "Enrollment",
  pluralName: "Enrollments",
  description: "Track a contact's progress and next follow-up in a campaign.",
  implements: [{ interface: NoteSubject }],
  properties: {
    name: schema.string({ label: "Name", maxLength: 300, minLength: 1 }),
    campaign: schema.reference(Campaign, {
      label: "Campaign",
      inverse: { key: "enrollments", label: "Enrollments" },
    }),
    contact: schema.reference(Contact, {
      label: "Contact",
      inverse: { key: "enrollments", label: "Enrollments" },
    }),
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
