import { GitHubIssue } from "#/modules/engineering/model/github-issue.ts"
import { GitHubPullRequest } from "#/modules/engineering/model/github-pull-request.ts"
import { defineLink } from "#/runtime/model/index.ts"

export const GitHubIssuePullRequests = defineLink({
  id: "githubIssuePullRequests",
  name: "GitHub issue pull requests",
  from: { object: GitHubIssue, key: "pullRequests", label: "Pull requests" },
  to: {
    object: GitHubPullRequest,
    key: "githubIssues",
    label: "GitHub issues",
  },
})
