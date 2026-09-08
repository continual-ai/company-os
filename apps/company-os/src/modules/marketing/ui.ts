import { campaignUi } from "#/modules/marketing/campaign/ui/config.ts"
import { contentUi } from "#/modules/marketing/content/ui/config.ts"
import { enrollmentUi } from "#/modules/marketing/enrollment/ui/config.ts"
import { MarketingModule } from "#/modules/marketing/model.ts"
import { outreachUi } from "#/modules/marketing/outreach/ui/config.ts"
import { defineModuleUi } from "#/ui/model/module-ui.tsx"
export const MarketingUi = defineModuleUi(MarketingModule, {
  campaign: campaignUi,
  content: contentUi,
  enrollment: enrollmentUi,
  outreach: outreachUi,
})
