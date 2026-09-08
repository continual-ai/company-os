import { defineModule } from "@company/runtime/model"

import { Campaign } from "#/model/campaign.ts"
import { Content } from "#/model/content.ts"
import { Enrollment } from "#/model/enrollment.ts"
import { Outreach } from "#/model/outreach.ts"

export const MarketingModule = defineModule({
  id: "marketing",
  requires: ["sales", "notes"],
  name: "Marketing",
  interfaces: [],
  links: [],
  objects: [Campaign, Content, Enrollment, Outreach],
})

export { Enrollment, Content, Campaign, Outreach }
