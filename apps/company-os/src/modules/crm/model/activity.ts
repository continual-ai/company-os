import { Account } from "#/modules/crm/model/account.ts"
import { Contact } from "#/modules/crm/model/contact.ts"
import { User } from "#/runtime/access/model/index.ts"
import { defineLink, defineObject, schema } from "#/runtime/model/index.ts"
import { NoteSubject } from "#/runtime/platform/model/note-subject.ts"

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

export const ActivityAccounts = defineLink({
  id: "activityAccounts",
  name: "Activity Account",
  from: { object: Activity, key: "accounts", label: "Accounts" },
  to: { object: Account, key: "activities", label: "Activities" },
})

export const ActivityContacts = defineLink({
  id: "activityContacts",
  name: "Activity Contact",
  from: { object: Activity, key: "contacts", label: "Contacts" },
  to: { object: Contact, key: "activities", label: "Activities" },
})

export const ActivityOwner = defineLink({
  id: "activityOwner",
  name: "Activity Owner",
  from: { object: Activity, key: "owner", label: "Owner", max: 1 },
  to: { object: User, key: "activities", label: "Activities" },
})
