import { defineCollectionView } from "@company/runtime/ui/module"
import type { ObjectUi } from "@company/runtime/ui/module"

import type { PullRequest } from "#/model/pull-request.ts"

export const pullRequestUi = {
  collection: {
    views: [
      defineCollectionView("all", "All pull requests", {
        columns: ["title", "repository", "status", "review", "checks"],
      }),
      defineCollectionView("open", "Open", {
        columns: ["title", "repository", "status", "review", "checks"],
        filters: [
          { id: "status", value: { operator: "equals", values: ["open"] } },
        ],
      }),
      defineCollectionView("changes", "Needs changes", {
        columns: ["title", "repository", "status", "review", "checks"],
        filters: [
          {
            id: "review",
            value: { operator: "equals", values: ["changesRequested"] },
          },
        ],
      }),
    ],
  },
} satisfies ObjectUi<typeof PullRequest>
