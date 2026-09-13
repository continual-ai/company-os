import { CircleDotIcon } from "lucide-react"

import type { Issue } from "#/modules/product/model/issue.ts"
import { IssueDescription } from "#/modules/product/ui/issue/description-field.tsx"
import { defineCollectionView, type ObjectUi } from "#/runtime/ui/module.ts"

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
          "kind",
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
          "kind",
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
          "kind",
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
        columns: ["title", "kind", "priority", "assignee", "dueDate"],
      }),
      defineCollectionView("calendar", "Due dates", {
        layout: { type: "calendar", start: "dueDate" },
        columns: ["title", "kind", "status", "assignee"],
      }),
    ],
  },
  fieldEditors: { description: IssueDescription },
} satisfies ObjectUi<typeof Issue>
