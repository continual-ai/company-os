import { defineModuleUi } from "@company/runtime/ui/module"

import { EngineeringModule } from "#/model/index.ts"
import { issueUi } from "#/ui/issue/config.ts"
import { projectUi } from "#/ui/project/config.ts"
import { pullRequestUi } from "#/ui/pull-request/config.ts"
import { repositoryUi } from "#/ui/repository/config.ts"
export const EngineeringUi = defineModuleUi(EngineeringModule, {
  issue: issueUi,
  project: projectUi,
  repository: repositoryUi,
  pullRequest: pullRequestUi,
})
