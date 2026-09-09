import { SupportEngineeringModule } from "#/modules/support-engineering/model/index.ts"
import { EscalationPage } from "#/modules/support-engineering/ui/escalation-page.tsx"
import { defineModuleUi } from "#/runtime/ui/module.ts"
export const SupportEngineeringUi = defineModuleUi(SupportEngineeringModule, {
  escalation: { collection: { pageComponent: EscalationPage } },
})
