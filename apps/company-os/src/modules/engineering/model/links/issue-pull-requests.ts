import { PullRequest } from "#/modules/engineering/model/pull-request.ts"
import { Issue } from "#/modules/product/model/issue.ts"
import { defineLink } from "#/runtime/model/index.ts"
export const IssuePullRequests = defineLink({
  id: "issuePullRequests",
  name: "Pull requests",
  from: { object: Issue, key: "pullRequests", label: "Pull requests", min: 0 },
  to: { object: PullRequest, key: "issues", label: "Issues", min: 0 },
})
