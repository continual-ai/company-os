import { Project } from "#/modules/work/model/project.ts"
import { Identity } from "#/runtime/access/model/index.ts"
import { defineLink, defineObject, schema } from "#/runtime/model/index.ts"
import { ControllerTarget } from "#/runtime/platform/model/controller-instance.ts"
import { NoteSubject } from "#/runtime/platform/model/note-subject.ts"

export const Task = defineObject({
  id: "task",
  collection: "tasks",
  name: "Task",
  pluralName: "Tasks",
  description:
    "Work with an accountable owner and completion criteria. Tasks may stand alone, belong to a project, or contain subtasks.",
  implements: [{ interface: ControllerTarget }, { interface: NoteSubject }],
  properties: {
    title: schema.string({ label: "Title", minLength: 1, maxLength: 300 }),
    description: schema.string({
      label: "Description",
      description: "Context, instructions, and the intended outcome.",
      nullable: true,
      maxLength: 50_000,
    }),
    acceptanceCriteria: schema.string({
      label: "Completion criteria",
      description:
        "The observable result and evidence needed to accept this work.",
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
    plannedStartDate: schema.date({ label: "Planned start", nullable: true }),
    plannedFinishDate: schema.date({ label: "Planned finish", nullable: true }),
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
  checks: {
    plannedDates: {
      left: "plannedStartDate",
      operator: "lte",
      right: "plannedFinishDate",
      message: "Planned finish must be on or after planned start.",
    },
  },
  search: { fields: ["title", "description", "acceptanceCriteria"] },
  display: { icon: "circleDot", title: "title", status: "status" },
})

export const TaskProject = defineLink({
  id: "taskProject",
  name: "Task Project",
  from: { object: Task, key: "project", label: "Project", max: 1 },
  to: { object: Project, key: "tasks", label: "Tasks" },
})

export const TaskOwner = defineLink({
  id: "taskOwner",
  name: "Task Owner",
  from: { object: Task, key: "owner", label: "Owner", max: 1 },
  to: { object: Identity, key: "ownedTasks", label: "Owned tasks" },
})

export const TaskParent = defineLink({
  id: "taskParent",
  name: "Task hierarchy",
  description:
    "Decompose work into subtasks. Nesting does not imply execution order or inherit project membership. Deleting a parent preserves its subtasks.",
  acyclic: true,
  from: { object: Task, key: "parent", label: "Parent task", max: 1 },
  to: { object: Task, key: "subtasks", label: "Subtasks" },
})

export const TaskDependencies = defineLink({
  id: "taskDependencies",
  name: "Task dependencies",
  description:
    "Predecessor tasks that this work depends on. Dependencies are separate from decomposition and may cross projects.",
  acyclic: true,
  from: { object: Task, key: "dependsOn", label: "Depends on" },
  to: { object: Task, key: "dependents", label: "Dependent tasks" },
})
