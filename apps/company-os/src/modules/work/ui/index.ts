import { WorkModule } from "#/modules/work/model/index.ts"
import { projectUi } from "#/modules/work/ui/project/config.ts"
import { taskUi } from "#/modules/work/ui/task/config.ts"
import { defineModuleUi } from "#/runtime/ui/module.ts"

export const WorkUi = defineModuleUi(WorkModule, {
  project: projectUi,
  task: taskUi,
})
