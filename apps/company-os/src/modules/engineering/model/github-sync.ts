import { GitHubRepository } from "#/modules/engineering/model/github-repository.ts"
import { defineController } from "#/runtime/model/index.ts"
import { Connection } from "#/runtime/platform/model/connection.ts"

export const GitHubDiscovery = defineController({
  id: "github-discovery",
  name: "Discover GitHub repositories",
  record: Connection,
  schedule: { cron: "*/15 * * * *", timeZone: "UTC" },
  minInterval: "5 seconds",
  ignoreUpdates: ["status", "lastError", "discoveryCursor", "discoveredAt"],
})

export const GitHubRepositorySync = defineController({
  id: "github-repository-sync",
  name: "Sync GitHub issues and pull requests",
  record: GitHubRepository,
  watch: ["connection"],
  schedule: { cron: "*/5 * * * *", timeZone: "UTC" },
  minInterval: "5 seconds",
  ignoreUpdates: [
    "syncError",
    "syncPage",
    "syncStartedAt",
    "syncSinceAt",
    "syncedAt",
    "fullSyncedAt",
  ],
})
