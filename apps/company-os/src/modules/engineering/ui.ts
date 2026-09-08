import { issueUi } from "#/modules/engineering/issue/ui/config.ts"
import { EngineeringModule } from "#/modules/engineering/model.ts"
import { projectUi } from "#/modules/engineering/project/ui/config.ts"
import { pullRequestUi } from "#/modules/engineering/pull-request/ui/config.ts"
import { repositoryUi } from "#/modules/engineering/repository/ui/config.ts"
import { defineModuleUi } from "#/ui/model/module-ui.tsx"
export const EngineeringUi = defineModuleUi(EngineeringModule, {
  issue: issueUi,
  project: projectUi,
  repository: repositoryUi,
  pullRequest: pullRequestUi,
})
