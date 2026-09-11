import { Project } from "#/modules/engineering/model/project.ts"
import { NoteSubject } from "#/modules/notes/model/index.ts"
import { User } from "#/runtime/access/model/index.ts"
import { defineLink, defineObject, schema } from "#/runtime/model/index.ts"

export const Issue = defineObject({
  id: "issue",
  collection: "issues",
  name: "Issue",
  pluralName: "Issues",
  description: "A bug, request, or task to investigate and resolve.",
  implements: [{ interface: NoteSubject }],
  properties: {
    title: schema.string({ label: "Title", minLength: 1, maxLength: 300 }),
    description: schema.string({
      label: "Description",
      nullable: true,
      maxLength: 50_000,
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

export const IssueProject = defineLink({
  id: "issueProject",
  name: "Issue Project",
  from: Issue,
  to: Project,
  forward: { key: "project", label: "Project", max: 1 },
  reverse: { key: "issues", label: "Issues" },
})

export const IssueAssignee = defineLink({
  id: "issueAssignee",
  name: "Issue Assignee",
  from: Issue,
  to: User,
  forward: { key: "assignee", label: "Assignee", max: 1 },
  reverse: { key: "issuesByAssignee", label: "Issues (Assignee)" },
})
