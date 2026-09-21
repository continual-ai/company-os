import { ListTodoIcon } from "lucide-react"

import { Model } from "#/app.model.ts"
import { Task } from "#/modules/work/model/task.ts"
import { defineCollectionView, type ObjectUi } from "#/runtime/ui/module.ts"

const columns = [
  "title",
  "status",
  "priority",
  "owner",
  "project",
  "parent",
  "dueDate",
] as const

export const taskUi = {
  navigation: {
    icon: ListTodoIcon,
    description:
      "Organize work, coordinate dependencies, and deliver accepted outcomes.",
  },
  collection: {
    views: [
      defineCollectionView(Model, Task, "all", "All tasks", { columns }),
      defineCollectionView(Model, Task, "active", "Active", {
        columns,
        filters: [
          {
            id: "status",
            value: { operator: "equals", values: ["planned", "inProgress"] },
          },
        ],
      }),
      defineCollectionView(Model, Task, "blocked", "Waiting on dependencies", {
        columns: [...columns, "dependsOn"],
        filters: [
          {
            id: "status",
            value: {
              operator: "equals",
              values: ["backlog", "planned", "inProgress"],
            },
          },
          {
            id: "dependsOn.status",
            value: {
              quantifier: "some",
              operator: "notEquals",
              values: ["done"],
            },
          },
        ],
      }),
      defineCollectionView(Model, Task, "standalone", "Without a project", {
        columns,
        filters: [{ id: "project", value: { operator: "empty", values: [] } }],
      }),
      defineCollectionView(Model, Task, "board", "Board", {
        layout: { type: "kanban", groupBy: "status" },
        columns: ["title", "priority", "owner", "project", "parent", "dueDate"],
      }),
      defineCollectionView(Model, Task, "schedule", "Schedule", {
        layout: {
          type: "gantt",
          start: "plannedStartDate",
          end: "plannedFinishDate",
        },
        columns: ["title", "status", "owner", "project", "parent"],
      }),
      defineCollectionView(Model, Task, "calendar", "Due dates", {
        layout: { type: "calendar", start: "dueDate" },
        columns: ["title", "status", "owner"],
      }),
    ],
  },
} satisfies ObjectUi<typeof Task>
