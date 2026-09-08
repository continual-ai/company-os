import { defineModuleUi } from "@company/runtime/ui/module"

import { SupportModule } from "#/modules/support/model/index.ts"
import { replyUi } from "#/modules/support/ui/reply/config.ts"
import { ticketUi } from "#/modules/support/ui/ticket/config.ts"
export const SupportUi = defineModuleUi(SupportModule, {
  ticket: ticketUi,
  reply: replyUi,
})
