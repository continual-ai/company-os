import { defineModuleUi } from "@company/runtime/ui/module"

import { SupportEngineeringModule } from "#/modules/support-engineering/model/index.ts"
import { EscalationPage } from "#/modules/support-engineering/ui/escalation-page.tsx"
export const SupportEngineeringUi = defineModuleUi(SupportEngineeringModule, {
  escalation: { collection: { pageComponent: EscalationPage } },
})
