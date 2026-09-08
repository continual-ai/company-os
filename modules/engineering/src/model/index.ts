import { defineModule } from "@company/runtime/model"

import { Issue } from "#/model/issue.ts"
import { IssuePullRequests } from "#/model/links/issue-pull-requests.ts"
import { Project } from "#/model/project.ts"
import { PullRequest } from "#/model/pull-request.ts"
import { Repository } from "#/model/repository.ts"
export const EngineeringModule = defineModule({
  id: "engineering",
  requires: ["access", "notes"],
  name: "Engineering",
  interfaces: [],
  links: [IssuePullRequests],
  objects: [Issue, Project, Repository, PullRequest],
})

export { Repository, PullRequest, Project, Issue }
