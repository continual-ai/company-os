import { IssueGreeting } from "#/modules/product/model/issue-greeting.ts"
import {
  Issue,
  IssueAssignee,
  IssueProject,
} from "#/modules/product/model/issue.ts"
import { Project, ProjectOwner } from "#/modules/product/model/project.ts"
import { defineModule } from "#/runtime/model/index.ts"

export const ProductModule = defineModule({
  id: "product",
  name: "Product",
  description: "Plan outcomes with projects and deliver work through issues.",
  maturity: "alpha",
  objects: [Project, Issue],
  controllers: [IssueGreeting],
  links: [ProjectOwner, IssueProject, IssueAssignee],
})

export { Project, Issue }
