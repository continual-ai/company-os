import type { GitHubConnection } from "#/modules/engineering/model/github-connection.ts"
import { defineCollectionView, type ObjectUi } from "#/runtime/ui/module.ts"

export const githubConnectionUi = {
  collection: {
    views: [
      defineCollectionView("all", "All connections", {
        columns: ["accountLogin", "installationId", "repositories"],
      }),
    ],
  },
} satisfies ObjectUi<typeof GitHubConnection>
