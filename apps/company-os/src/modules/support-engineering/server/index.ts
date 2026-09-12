import { SupportEngineeringModule } from "#/modules/support-engineering/model/index.ts"
import { escalateTicket } from "#/modules/support-engineering/server/escalate-ticket.ts"
import { defineModuleServer } from "#/runtime/server/index.ts"
export const SupportEngineeringServer = defineModuleServer(
  SupportEngineeringModule,
  { ticket: { escalate: escalateTicket } }
)
