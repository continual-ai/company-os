import { ServiceModule } from "#/modules/service/model/index.ts"
import { replyUi } from "#/modules/service/ui/reply/config.ts"
import { ticketUi } from "#/modules/service/ui/ticket/config.ts"
import { defineModuleUi } from "#/runtime/ui/module.ts"
export const ServiceUi = defineModuleUi(ServiceModule, {
  ticket: ticketUi,
  reply: replyUi,
})
