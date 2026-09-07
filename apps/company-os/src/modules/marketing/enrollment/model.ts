import { defineObject, schema } from "@company/runtime"

import { Campaign } from "#modules/marketing/campaign/model"
import { Contact } from "#modules/sales/contact/model"
import { NoteSubject } from "#modules/sales/interfaces/note-subject"
import { Root } from "#root"

export const Enrollment = defineObject({
  id: "enrollment",
  collection: "enrollments",
  name: "Enrollment",
  pluralName: "Enrollments",
  description: "Track a contact's progress and next follow-up in a campaign.",
  parent: Root,
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
