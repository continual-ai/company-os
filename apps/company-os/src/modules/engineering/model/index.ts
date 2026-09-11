import {
  Issue,
  IssueAssignee,
  IssueProject,
} from "#/modules/engineering/model/issue.ts"
import { IssuePullRequests } from "#/modules/engineering/model/links/issue-pull-requests.ts"
import { Project, ProjectOwner } from "#/modules/engineering/model/project.ts"
import {
  PullRequest,
  PullRequestRepository,
} from "#/modules/engineering/model/pull-request.ts"
import {
  Repository,
  RepositoryOwner,
  RepositoryProject,
} from "#/modules/engineering/model/repository.ts"
import { defineModule } from "#/runtime/model/index.ts"
export const EngineeringModule = defineModule({
  maturity: "alpha",
  origin: {
    name: "Company OS",
    url: "https://github.com/continual-ai/company-os",
  },
  description: "Organize projects, issues, repositories, and pull requests.",
  id: "engineering",
  name: "Engineering",
  links: [
    IssuePullRequests,
    IssueProject,
    IssueAssignee,
    ProjectOwner,
    PullRequestRepository,
    RepositoryProject,
    RepositoryOwner,
  ],
  objects: [Issue, Project, Repository, PullRequest],
})

export { Issue, Project, PullRequest, Repository }
