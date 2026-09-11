import { Issue } from "#/modules/engineering/model/issue.ts"
import { PullRequest } from "#/modules/engineering/model/pull-request.ts"
import { defineLink } from "#/runtime/model/index.ts"
export const IssuePullRequests = defineLink({
  id: "issuePullRequests",
  name: "Pull requests",
  from: Issue,
  to: PullRequest,
  forward: {
    key: "pullRequests",
    label: "Pull requests",
    min: 0,
  },
  reverse: {
    key: "issues",
    label: "Issues",
    min: 0,
  },
})
