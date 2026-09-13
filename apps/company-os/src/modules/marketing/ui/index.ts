import { MarketingModule } from "#/modules/marketing/model/index.ts"
import { campaignMemberUi } from "#/modules/marketing/ui/campaign-member/config.ts"
import { campaignUi } from "#/modules/marketing/ui/campaign/config.ts"
import { contentUi } from "#/modules/marketing/ui/content/config.ts"
import { outreachUi } from "#/modules/marketing/ui/outreach/config.ts"
import { defineModuleUi } from "#/runtime/ui/module.ts"
export const MarketingUi = defineModuleUi(MarketingModule, {
  campaign: campaignUi,
  content: contentUi,
  campaignMember: campaignMemberUi,
  outreach: outreachUi,
})
