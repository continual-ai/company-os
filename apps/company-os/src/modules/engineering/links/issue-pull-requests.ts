import { defineLink } from "@company/runtime"

import { Issue } from "#modules/engineering/issue/model"
import { PullRequest } from "#modules/engineering/pull-request/model"
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
