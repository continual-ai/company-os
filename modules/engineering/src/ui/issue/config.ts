import { defineCollectionView } from "@company/runtime/ui/module"
import type { ObjectUi } from "@company/runtime/ui/module"
import { CircleDotIcon } from "lucide-react"

import type { Issue } from "#/model/issue.ts"
import { IssueDescription } from "#/ui/issue/description-field.tsx"

export const issueUi = {
  navigation: {
    icon: CircleDotIcon,
    description: "Track planned work, assign owners, and resolve issues.",
  },
  collection: {
    views: [
      defineCollectionView("all", "All issues", {
        columns: [
          "title",
          "status",
          "priority",
          "assignee",
          "project",
          "dueDate",
        ],
      }),
      defineCollectionView("active", "Active", {
        columns: [
          "title",
          "status",
          "priority",
          "assignee",
          "project",
          "dueDate",
        ],
        filters: [
          {
            id: "status",
            value: { operator: "equals", values: ["planned", "inProgress"] },
          },
        ],
      }),
      defineCollectionView("backlog", "Backlog", {
        columns: [
          "title",
          "status",
          "priority",
          "assignee",
          "project",
          "dueDate",
        ],
        filters: [
          { id: "status", value: { operator: "equals", values: ["backlog"] } },
        ],
      }),
      defineCollectionView("board", "Board", {
        layout: { type: "kanban", groupBy: "status" },
        columns: ["title", "priority", "assignee", "dueDate"],
      }),
      defineCollectionView("calendar", "Due dates", {
        layout: { type: "calendar", start: "dueDate" },
        columns: ["title", "status", "assignee"],
      }),
    ],
  },
  fieldEditors: { description: IssueDescription },
} satisfies ObjectUi<typeof Issue>
