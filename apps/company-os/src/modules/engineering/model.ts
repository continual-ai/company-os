import { defineModule } from "@company/runtime"

import { Issue } from "./issue/model"
import { IssuePullRequests } from "./links/issue-pull-requests"
import { Project } from "./project/model"
import { PullRequest } from "./pull-request/model"
import { Repository } from "./repository/model"
export const EngineeringModule = defineModule({
  id: "engineering",
  name: "Engineering",
  interfaces: [],
  links: [IssuePullRequests],
  objects: [Issue, Project, Repository, PullRequest],
})
