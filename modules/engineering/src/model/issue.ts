import { NoteSubject } from "@company/notes/model"
import { defineObject, schema } from "@company/runtime/model"
import { AuthorizationScope, Root, User } from "@company/runtime/model/access"

import { Project } from "#/model/project.ts"

export const Issue = defineObject({
  id: "issue",
  collection: "issues",
  name: "Issue",
  pluralName: "Issues",
  description: "A bug, request, or task to investigate and resolve.",
  parent: Root,
  implements: [{ interface: AuthorizationScope }, { interface: NoteSubject }],
  properties: {
    title: schema.string({ label: "Title", minLength: 1, maxLength: 300 }),
    description: schema.string({
      label: "Description",
      nullable: true,
      maxLength: 50_000,
    }),
    project: schema.reference(Project, {
      label: "Project",
      nullable: true,
      inverse: { key: "issues", label: "Issues" },
    }),
    priority: schema.select({
      label: "Priority",
      default: "normal",
      options: [
        { value: "normal", label: "Normal" },
        { value: "low", label: "Low" },
        { value: "high", label: "High" },
        { value: "urgent", label: "Urgent" },
      ],
    }),
    dueDate: schema.date({ label: "Due date", nullable: true }),
    assignee: schema.reference(User, { label: "Assignee", nullable: true }),
    status: schema.select({
      label: "Status",
      default: "backlog",
      options: [
        { value: "backlog", label: "Backlog" },
        { value: "planned", label: "Planned" },
        { value: "inProgress", label: "In progress" },
        { value: "done", label: "Done" },
      ],
    }),
    attachments: schema.array(schema.file({ maxBytes: 25_000_000 }), {
      label: "Attachments",
      default: [],
    }),
  },
  search: { fields: ["title", "description"] },
  display: { icon: "circleDot", title: "title", status: "status" },
})
