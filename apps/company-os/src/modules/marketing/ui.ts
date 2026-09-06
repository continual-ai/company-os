import { defineModuleUi } from "@/ui/model/module-ui"

import { campaignUi } from "./campaign/ui/config"
import { contentUi } from "./content/ui/config"
import { enrollmentUi } from "./enrollment/ui/config"
import { MarketingModule } from "./model"
import { outreachUi } from "./outreach/ui/config"
export const MarketingUi = defineModuleUi(MarketingModule, {
  campaign: campaignUi,
  content: contentUi,
  enrollment: enrollmentUi,
  outreach: outreachUi,
})
