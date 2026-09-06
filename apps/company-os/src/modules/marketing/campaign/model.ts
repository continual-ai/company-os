import { defineObject, schema } from "@company/runtime"

import { User } from "#modules/access/user/model"
import { NoteSubject } from "#modules/sales/interfaces/note-subject"
import { Root } from "#root"

export const Campaign = defineObject({
  id: "campaign",
  collection: "campaigns",
  name: "Campaign",
  pluralName: "Campaigns",
  description:
    "A coordinated marketing initiative with an objective, budget, owner, and operating window.",
  parent: Root,
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
  display: { title: "name", icon: "megaphone", status: "status" },
})
