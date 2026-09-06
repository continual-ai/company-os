import { defineModuleUi } from "@/ui/model/module-ui"

import { issueUi } from "./issue/ui/config"
import { EngineeringModule } from "./model"
export const EngineeringUi = defineModuleUi(EngineeringModule, {
  issue: issueUi,
})
