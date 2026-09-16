import { EngineeringModule } from "#/modules/engineering/model/index.ts"
import { githubConnectionUi } from "#/modules/engineering/ui/github-connection/config.ts"
import { githubIssueUi } from "#/modules/engineering/ui/github-issue/config.ts"
import { githubPullRequestUi } from "#/modules/engineering/ui/github-pull-request/config.ts"
import { githubRepositoryUi } from "#/modules/engineering/ui/github-repository/config.ts"
import { defineModuleUi } from "#/runtime/ui/module.ts"

export const EngineeringUi = defineModuleUi(EngineeringModule, {
  githubConnection: githubConnectionUi,
  githubRepository: githubRepositoryUi,
  githubPullRequest: githubPullRequestUi,
  githubIssue: githubIssueUi,
})
