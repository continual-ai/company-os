import { defineModule } from "@company/runtime"

import { Issue } from "#/modules/engineering/issue/model.ts"
import { IssuePullRequests } from "#/modules/engineering/links/issue-pull-requests.ts"
import { Project } from "#/modules/engineering/project/model.ts"
import { PullRequest } from "#/modules/engineering/pull-request/model.ts"
import { Repository } from "#/modules/engineering/repository/model.ts"
export const EngineeringModule = defineModule({
  id: "engineering",
  name: "Engineering",
  interfaces: [],
  links: [IssuePullRequests],
  objects: [Issue, Project, Repository, PullRequest],
})
