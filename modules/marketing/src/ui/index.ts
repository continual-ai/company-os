import { defineModuleUi } from "@company/runtime/ui/module"

import { MarketingModule } from "#/model/index.ts"
import { campaignUi } from "#/ui/campaign/config.ts"
import { contentUi } from "#/ui/content/config.ts"
import { enrollmentUi } from "#/ui/enrollment/config.ts"
import { outreachUi } from "#/ui/outreach/config.ts"
export const MarketingUi = defineModuleUi(MarketingModule, {
  campaign: campaignUi,
  content: contentUi,
  enrollment: enrollmentUi,
  outreach: outreachUi,
})
