import { Issue } from "#/modules/engineering/model/issue.ts"
import { PullRequest } from "#/modules/engineering/model/pull-request.ts"
import { defineLink } from "#/runtime/model/index.ts"
export const IssuePullRequests = defineLink({
  id: "issuePullRequests",
  name: "Pull requests",
  writeFrom: "pullRequests",
  forward: {
    from: Issue,
    to: PullRequest,
    key: "pullRequests",
    label: "Pull requests",
    cardinality: "many",
  },
  reverse: {
    from: PullRequest,
    to: Issue,
    key: "issues",
    label: "Issues",
    cardinality: "many",
  },
})
