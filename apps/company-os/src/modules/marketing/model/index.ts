import { Campaign } from "#/modules/marketing/model/campaign.ts"
import { Content } from "#/modules/marketing/model/content.ts"
import { Enrollment } from "#/modules/marketing/model/enrollment.ts"
import { Outreach } from "#/modules/marketing/model/outreach.ts"
import { defineModule } from "#/runtime/model/index.ts"

export const MarketingModule = defineModule({
  id: "marketing",
  name: "Marketing",
  objects: [Campaign, Content, Enrollment, Outreach],
})

export { Enrollment, Content, Campaign, Outreach }
