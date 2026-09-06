import { defineObject, schema } from "@company/runtime"

import { User } from "#modules/access/user/model"
import { NoteSubject } from "#modules/sales/interfaces/note-subject"
import { Root } from "#root"

export const Project = defineObject({
  id: "project",
  collection: "projects",
  name: "Project",
  pluralName: "Projects",
  description:
    "An engineering outcome with an owner, scope, and delivery target.",
  parent: Root,
  implements: [{ interface: NoteSubject }],
  properties: {
    name: schema.string({ label: "Name", maxLength: 300, minLength: 1 }),
    objective: schema.string({
      label: "Objective",
      maxLength: 10000,
      nullable: true,
    }),
    owner: schema.reference(User, {
      label: "Owner",
      nullable: true,
      inverse: { key: "projects", label: "Projects" },
    }),
    status: schema.select({
      label: "Status",
      default: "planned",
      options: [
        { value: "planned", label: "Planned" },
        { value: "active", label: "Active" },
        { value: "paused", label: "Paused" },
        { value: "completed", label: "Completed" },
      ],
    }),
    targetDate: schema.date({ label: "Target date", nullable: true }),
  },
  search: { fields: ["name", "objective"] },
  display: { title: "name", icon: "folder", status: "status" },
})
