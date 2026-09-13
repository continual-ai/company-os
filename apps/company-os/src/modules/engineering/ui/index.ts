import { EngineeringModule } from "#/modules/engineering/model/index.ts"
import { pullRequestUi } from "#/modules/engineering/ui/pull-request/config.ts"
import { repositoryUi } from "#/modules/engineering/ui/repository/config.ts"
import { defineModuleUi } from "#/runtime/ui/module.ts"
export const EngineeringUi = defineModuleUi(EngineeringModule, {
  repository: repositoryUi,
  pullRequest: pullRequestUi,
})
