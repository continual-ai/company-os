import { defineModuleUi } from "@/ui/model/module-ui"

import { SupportModule } from "./model"
import { replyUi } from "./reply/ui/config"
import { ticketUi } from "./ticket/ui/config"
export const SupportUi = defineModuleUi(SupportModule, {
  ticket: ticketUi,
  reply: replyUi,
})
