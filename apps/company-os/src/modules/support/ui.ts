import { SupportModule } from "#/modules/support/model.ts"
import { replyUi } from "#/modules/support/reply/ui/config.ts"
import { ticketUi } from "#/modules/support/ticket/ui/config.ts"
import { defineModuleUi } from "#/ui/model/module-ui.tsx"
export const SupportUi = defineModuleUi(SupportModule, {
  ticket: ticketUi,
  reply: replyUi,
})
