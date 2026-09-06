import { defineModuleUi } from "@/ui/model/module-ui"

import { issueUi } from "./issue/ui/config"
import { EngineeringModule } from "./model"
import { projectUi } from "./project/ui/config"
import { pullRequestUi } from "./pull-request/ui/config"
import { repositoryUi } from "./repository/ui/config"
export const EngineeringUi = defineModuleUi(EngineeringModule, {
  issue: issueUi,
  project: projectUi,
  repository: repositoryUi,
  pullRequest: pullRequestUi,
})
