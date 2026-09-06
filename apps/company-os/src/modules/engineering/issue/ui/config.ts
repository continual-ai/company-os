import type { Model } from "company-os/model"
import { CircleDotIcon } from "lucide-react"

import type { ObjectUi } from "@/ui/model/module-ui"
import { defineCollectionView } from "@/ui/model/object-collection-view"

import { IssueDescription } from "./description-field"

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
    ],
  },
  fieldEditors: { description: IssueDescription },
} satisfies ObjectUi<typeof Model.objects.issue>
