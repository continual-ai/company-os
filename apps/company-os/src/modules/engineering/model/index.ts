import { IssuePullRequests } from "#/modules/engineering/model/links/issue-pull-requests.ts"
import {
  PullRequest,
  PullRequestRepository,
} from "#/modules/engineering/model/pull-request.ts"
import {
  Repository,
  RepositoryOwner,
  RepositoryProjects,
} from "#/modules/engineering/model/repository.ts"
import { defineModule } from "#/runtime/model/index.ts"
export const EngineeringModule = defineModule({
  maturity: "alpha",
  origin: {
    name: "Company OS",
    url: "https://github.com/continual-ai/company-os",
  },
  description: "Connect repositories and pull requests to product delivery.",
  id: "engineering",
  name: "Engineering",
  links: [
    IssuePullRequests,
    PullRequestRepository,
    RepositoryProjects,
    RepositoryOwner,
  ],
  objects: [Repository, PullRequest],
})

export { PullRequest, Repository }
