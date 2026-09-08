import { NoteSubject } from "@company/notes/model"
import { defineObject, schema } from "@company/runtime/model"
import { Root, User } from "@company/runtime/model/access"

import { Company } from "#/model/company.ts"
import { Contact } from "#/model/contact.ts"
import { Deal } from "#/model/deal.ts"

export const Activity = defineObject({
  id: "activity",
  collection: "activities",
  name: "Activity",
  pluralName: "Activities",
  description: "A task, call, or meeting with a customer or prospect.",
  parent: Root,
  implements: [{ interface: NoteSubject }],
  properties: {
    title: schema.string({ label: "Title", maxLength: 300, minLength: 1 }),
    company: schema.reference(Company, {
      label: "Company",
      nullable: true,
      inverse: { key: "activities", label: "Activities" },
    }),
    contact: schema.reference(Contact, {
      label: "Contact",
      nullable: true,
      inverse: { key: "activities", label: "Activities" },
    }),
    deal: schema.reference(Deal, {
      label: "Deal",
      nullable: true,
      inverse: { key: "activities", label: "Activities" },
    }),
    owner: schema.reference(User, {
      label: "Owner",
      nullable: true,
      inverse: { key: "activities", label: "Activities" },
    }),
    kind: schema.select({
      label: "Kind",
      default: "task",
      options: [
        { value: "task", label: "Task" },
        { value: "call", label: "Call" },
        { value: "meeting", label: "Meeting" },
      ],
    }),
    status: schema.select({
      label: "Status",
      default: "planned",
      options: [
        { value: "planned", label: "Planned" },
        { value: "done", label: "Done" },
        { value: "canceled", label: "Canceled" },
      ],
    }),
    dueAt: schema.timestamp({ label: "Due at", nullable: true }),
    outcome: schema.string({
      label: "Outcome",
      maxLength: 20000,
      nullable: true,
    }),
  },
  search: { fields: ["title", "outcome"] },
  display: { title: "title", icon: "checkSquare", status: "status" },
})
