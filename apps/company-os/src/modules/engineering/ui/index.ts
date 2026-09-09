import { EngineeringModule } from "#/modules/engineering/model/index.ts"
import { issueUi } from "#/modules/engineering/ui/issue/config.ts"
import { projectUi } from "#/modules/engineering/ui/project/config.ts"
import { pullRequestUi } from "#/modules/engineering/ui/pull-request/config.ts"
import { repositoryUi } from "#/modules/engineering/ui/repository/config.ts"
import { defineModuleUi } from "#/runtime/ui/module.ts"
export const EngineeringUi = defineModuleUi(EngineeringModule, {
  issue: issueUi,
  project: projectUi,
  repository: repositoryUi,
  pullRequest: pullRequestUi,
})
