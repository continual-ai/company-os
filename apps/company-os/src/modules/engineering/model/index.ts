import { GitHub } from "#/modules/engineering/model/github-connector.ts"
import {
  GitHubIssue,
  GitHubIssueRepository,
} from "#/modules/engineering/model/github-issue.ts"
import {
  GitHubPullRequest,
  GitHubPullRequestRepository,
} from "#/modules/engineering/model/github-pull-request.ts"
import {
  GitHubRepository,
  ApplyRepositorySnapshot,
  GitHubRepositoryConnection,
  GitHubRepositoryProjects,
  GitHubRepositoryMaintainer,
} from "#/modules/engineering/model/github-repository.ts"
import {
  GitHubDiscovery,
  GitHubRepositorySync,
} from "#/modules/engineering/model/github-sync.ts"
import { GitHubIssuePullRequests } from "#/modules/engineering/model/links/github-issue-pull-requests.ts"
import {
  TaskGitHubIssues,
  TaskGitHubPullRequests,
} from "#/modules/engineering/model/links/work-tasks.ts"
import { defineModule } from "#/runtime/model/index.ts"

export const EngineeringModule = defineModule({
  maturity: "alpha",
  origin: {
    name: "Company OS",
    url: "https://github.com/continual-ai/company-os",
  },
  description:
    "Connect GitHub repositories, issues, and pull requests to product delivery.",
  id: "engineering",
  name: "Engineering",
  links: [
    GitHubRepositoryConnection,
    GitHubRepositoryProjects,
    GitHubRepositoryMaintainer,
    GitHubIssueRepository,
    GitHubPullRequestRepository,
    GitHubIssuePullRequests,
    TaskGitHubIssues,
    TaskGitHubPullRequests,
  ],
  objects: [GitHubRepository, GitHubPullRequest, GitHubIssue],
  actions: [ApplyRepositorySnapshot],
  connectors: [GitHub],
  controllers: [GitHubDiscovery, GitHubRepositorySync],
})

export { GitHubRepository, GitHubPullRequest, GitHubIssue }
