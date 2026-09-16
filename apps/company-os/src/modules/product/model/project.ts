import { User } from "#/runtime/access/model/index.ts"
import { defineLink, defineObject, schema } from "#/runtime/model/index.ts"
import { NoteSubject } from "#/runtime/platform/model/note-subject.ts"

export const Project = defineObject({
  id: "project",
  collection: "projects",
  name: "Project",
  pluralName: "Projects",
  description: "Related work organized around a goal and target date.",
  implements: [{ interface: NoteSubject }],
  properties: {
    name: schema.string({ label: "Name", maxLength: 300, minLength: 1 }),
    objective: schema.string({
      label: "Objective",
      maxLength: 10000,
      nullable: true,
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

export const ProjectOwner = defineLink({
  id: "projectOwner",
  name: "Project Owner",
  from: { object: Project, key: "owner", label: "Owner", max: 1 },
  to: { object: User, key: "projects", label: "Projects" },
})
