import type { Model } from "company-os/model"

import type { ObjectUi } from "@/ui/model/module-ui"
import { defineCollectionView } from "@/ui/model/object-collection-view"

export const repositoryUi = {
  collection: {
    views: [
      defineCollectionView("all", "All repositories", {
        columns: ["name", "project", "url", "defaultBranch"],
        sorting: [{ id: "name", desc: false }],
      }),
    ],
  },
} satisfies ObjectUi<typeof Model.objects.repository>
