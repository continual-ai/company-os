import { Project, ProjectOwner } from "#/modules/work/model/project.ts"
import {
  Task,
  TaskOwner,
  TaskProject,
  TaskParent,
  TaskDependencies,
} from "#/modules/work/model/task.ts"
import { defineModule } from "#/runtime/model/index.ts"

export const WorkModule = defineModule({
  id: "work",
  name: "Work",
  description: "Plan outcomes with projects and deliver work through tasks.",
  maturity: "alpha",
  objects: [Project, Task],
  links: [ProjectOwner, TaskProject, TaskOwner, TaskParent, TaskDependencies],
})

export { Project, Task }
