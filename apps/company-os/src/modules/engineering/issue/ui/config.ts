import { defineCollectionView } from "@company/ui/model/collection-view"
import type { ObjectUi } from "@company/ui/model/object-ui"
import { CircleDotIcon } from "lucide-react"

import type { Model } from "#/app.model.ts"
import { IssueDescription } from "#/modules/engineering/issue/ui/description-field.tsx"

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
} satisfies ObjectUi<typeof Model.objects.issue>
