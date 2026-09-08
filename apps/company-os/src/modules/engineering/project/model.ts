import { NoteSubject } from "@company/notes/note-subject"
import { defineObject, schema } from "@company/runtime"

import { Root } from "#/model-root.ts"
import { User } from "#/modules/access/user/model.ts"

export const Project = defineObject({
  id: "project",
  collection: "projects",
  name: "Project",
  pluralName: "Projects",
  description: "Related work organized around a goal and target date.",
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
