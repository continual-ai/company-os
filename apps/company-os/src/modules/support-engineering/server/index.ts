import { SupportEngineeringModule } from "#/modules/support-engineering/model/index.ts"
import { createIssue } from "#/modules/support-engineering/server/create-issue.ts"
import { defineModuleServer } from "#/runtime/server/index.ts"
export const SupportEngineeringServer = defineModuleServer(
  SupportEngineeringModule,
  { escalation: { createIssue } }
)
