import { NoteSubject } from "#/modules/notes/model/index.ts"
import { User } from "#/runtime/access/model/index.ts"
import { defineObject, schema } from "#/runtime/model/index.ts"

export const Campaign = defineObject({
  id: "campaign",
  collection: "campaigns",
  name: "Campaign",
  pluralName: "Campaigns",
  description:
    "Plan a marketing campaign and track its budget, dates, and audience.",
  implements: [{ interface: NoteSubject }],
  properties: {
    name: schema.string({ label: "Name", maxLength: 300, minLength: 1 }),
    objective: schema.string({
      label: "Objective",
      maxLength: 10000,
      nullable: true,
    }),
    channel: schema.select({
      label: "Channel",
      default: "content",
      options: [
        { value: "content", label: "Content" },
        { value: "paid", label: "Paid advertising" },
        { value: "outbound", label: "Outbound" },
        { value: "nurture", label: "Nurture" },
        { value: "event", label: "Event" },
      ],
    }),
    status: schema.select({
      label: "Status",
      default: "draft",
      options: [
        { value: "draft", label: "Draft" },
        { value: "planned", label: "Planned" },
        { value: "active", label: "Active" },
        { value: "paused", label: "Paused" },
        { value: "completed", label: "Completed" },
      ],
    }),
    owner: schema.reference(User, {
      label: "Owner",
      nullable: true,
      inverse: { key: "campaigns", label: "Campaigns" },
    }),
    budget: schema.money({ label: "Budget", nullable: true }),
    startDate: schema.date({ label: "Starts on", nullable: true }),
    endDate: schema.date({ label: "Ends on", nullable: true }),
  },
  search: { fields: ["name", "objective"] },
  display: { title: "name", icon: "megaphone", status: "status" },
})
