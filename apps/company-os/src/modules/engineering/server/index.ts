import { EngineeringModule } from "#/modules/engineering/model/index.ts"
import {
  GitHubClients,
  GitHubConnector,
} from "#/modules/engineering/server/github-connector.ts"
import { githubDiscovery } from "#/modules/engineering/server/github-discovery.ts"
import { githubRepositorySync } from "#/modules/engineering/server/github-repository-sync.ts"
import { applyRepositorySnapshot } from "#/modules/engineering/server/repository-snapshot.ts"
import { defineModuleServer } from "#/runtime/server/index.ts"

export const EngineeringServer = defineModuleServer(EngineeringModule, {
  operations: { githubRepository: { applySnapshot: applyRepositorySnapshot } },
  connectors: [GitHubConnector],
  controllers: [githubDiscovery, githubRepositorySync],
  layer: GitHubClients.layer,
})
