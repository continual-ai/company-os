import { defineLink } from "@company/runtime/model"

import { Issue } from "#/model/issue.ts"
import { PullRequest } from "#/model/pull-request.ts"
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
