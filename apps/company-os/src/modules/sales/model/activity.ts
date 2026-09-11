import { NoteSubject } from "#/modules/notes/model/index.ts"
import { Company } from "#/modules/sales/model/company.ts"
import { Contact } from "#/modules/sales/model/contact.ts"
import { Deal } from "#/modules/sales/model/deal.ts"
import { User } from "#/runtime/access/model/index.ts"
import { defineLink, defineObject, schema } from "#/runtime/model/index.ts"

export const Activity = defineObject({
  id: "activity",
  collection: "activities",
  name: "Activity",
  pluralName: "Activities",
  description: "A task, call, or meeting with a customer or prospect.",
  implements: [{ interface: NoteSubject }],
  properties: {
    title: schema.string({ label: "Title", maxLength: 300, minLength: 1 }),
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

export const ActivityCompany = defineLink({
  id: "activityCompany",
  name: "Activity Company",
  from: Activity,
  to: Company,
  forward: { key: "company", label: "Company", max: 1 },
  reverse: { key: "activities", label: "Activities" },
})

export const ActivityContact = defineLink({
  id: "activityContact",
  name: "Activity Contact",
  from: Activity,
  to: Contact,
  forward: { key: "contact", label: "Contact", max: 1 },
  reverse: { key: "activities", label: "Activities" },
})

export const ActivityDeal = defineLink({
  id: "activityDeal",
  name: "Activity Deal",
  from: Activity,
  to: Deal,
  forward: { key: "deal", label: "Deal", max: 1 },
  reverse: { key: "activities", label: "Activities" },
})

export const ActivityOwner = defineLink({
  id: "activityOwner",
  name: "Activity Owner",
  from: Activity,
  to: User,
  forward: { key: "owner", label: "Owner", max: 1 },
  reverse: { key: "activities", label: "Activities" },
})
