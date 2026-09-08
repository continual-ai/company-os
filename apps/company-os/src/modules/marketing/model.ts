import { defineModule } from "@company/runtime"

import { Campaign } from "#/modules/marketing/campaign/model.ts"
import { Content } from "#/modules/marketing/content/model.ts"
import { Enrollment } from "#/modules/marketing/enrollment/model.ts"
import { Outreach } from "#/modules/marketing/outreach/model.ts"

export const MarketingModule = defineModule({
  id: "marketing",
  name: "Marketing",
  interfaces: [],
  links: [],
  objects: [Campaign, Content, Enrollment, Outreach],
})
