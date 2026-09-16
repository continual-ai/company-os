import { Project } from "#/modules/product/model/project.ts"
import { User } from "#/runtime/access/model/index.ts"
import { defineLink, defineObject, schema } from "#/runtime/model/index.ts"
import { ControllerTarget } from "#/runtime/platform/model/controller-instance.ts"
import { NoteSubject } from "#/runtime/platform/model/note-subject.ts"

export const Issue = defineObject({
  id: "issue",
  collection: "issues",
  name: "Issue",
  pluralName: "Issues",
  description: "A bug, request, or task to investigate and resolve.",
  implements: [{ interface: ControllerTarget }, { interface: NoteSubject }],
  properties: {
    title: schema.string({ label: "Title", minLength: 1, maxLength: 300 }),
    description: schema.string({
      label: "Description",
      nullable: true,
      maxLength: 50_000,
    }),
    kind: schema.select({
      label: "Kind",
      default: "task",
      options: [
        { value: "task", label: "Task" },
        { value: "bug", label: "Bug" },
        { value: "feature", label: "Feature" },
      ],
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
        { value: "canceled", label: "Canceled" },
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
  from: { object: Issue, key: "project", label: "Project", max: 1 },
  to: { object: Project, key: "issues", label: "Issues" },
})

export const IssueAssignee = defineLink({
  id: "issueAssignee",
  name: "Issue Assignee",
  from: { object: Issue, key: "assignee", label: "Assignee", max: 1 },
  to: { object: User, key: "issuesByAssignee", label: "Issues (Assignee)" },
})
