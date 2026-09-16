import { GitHubIssue } from "#/modules/engineering/model/github-issue.ts"
import { GitHubPullRequest } from "#/modules/engineering/model/github-pull-request.ts"
import { Issue } from "#/modules/product/model/issue.ts"
import { defineLink } from "#/runtime/model/index.ts"

export const IssueGitHubPullRequests = defineLink({
  id: "issueGithubPullRequests",
  name: "Product issue GitHub pull requests",
  from: {
    object: Issue,
    key: "githubPullRequests",
    label: "GitHub pull requests",
  },
  to: {
    object: GitHubPullRequest,
    key: "productIssues",
    label: "Product issues",
  },
})

export const IssueGitHubIssues = defineLink({
  id: "issueGithubIssues",
  name: "Product issue GitHub issues",
  from: { object: Issue, key: "githubIssues", label: "GitHub issues" },
  to: { object: GitHubIssue, key: "productIssues", label: "Product issues" },
})
