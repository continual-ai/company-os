import { Issue } from "#/modules/engineering/model/issue.ts"
import { IssuePullRequests } from "#/modules/engineering/model/links/issue-pull-requests.ts"
import { Project } from "#/modules/engineering/model/project.ts"
import { PullRequest } from "#/modules/engineering/model/pull-request.ts"
import { Repository } from "#/modules/engineering/model/repository.ts"
import { defineModule } from "#/runtime/model/index.ts"
export const EngineeringModule = defineModule({
  id: "engineering",
  name: "Engineering",
  links: [IssuePullRequests],
  objects: [Issue, Project, Repository, PullRequest],
})

export { Repository, PullRequest, Project, Issue }
