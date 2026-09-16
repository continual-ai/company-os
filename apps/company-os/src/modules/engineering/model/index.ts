import { GitHubConnection } from "#/modules/engineering/model/github-connection.ts"
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
  GitHubRepositoryConnection,
  GitHubRepositoryProjects,
  GitHubRepositoryMaintainer,
} from "#/modules/engineering/model/github-repository.ts"
import { GitHubIssuePullRequests } from "#/modules/engineering/model/links/github-issue-pull-requests.ts"
import {
  IssueGitHubIssues,
  IssueGitHubPullRequests,
} from "#/modules/engineering/model/links/product-issues.ts"
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
    IssueGitHubIssues,
    IssueGitHubPullRequests,
  ],
  objects: [GitHubConnection, GitHubRepository, GitHubPullRequest, GitHubIssue],
})

export { GitHubConnection, GitHubRepository, GitHubPullRequest, GitHubIssue }
