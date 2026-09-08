import { defineModuleServer } from "@company/runtime/server"

import { SupportEngineeringModule } from "#/modules/support-engineering/model/index.ts"
import { createIssue } from "#/modules/support-engineering/server/create-issue.ts"
export const SupportEngineeringServer = defineModuleServer(
  SupportEngineeringModule,
  { escalation: { createIssue } }
)
