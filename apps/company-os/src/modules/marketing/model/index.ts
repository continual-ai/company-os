import { Campaign, CampaignOwner } from "#/modules/marketing/model/campaign.ts"
import {
  Content,
  ContentCampaign,
  ContentOwner,
} from "#/modules/marketing/model/content.ts"
import {
  Enrollment,
  EnrollmentCampaign,
  EnrollmentContact,
} from "#/modules/marketing/model/enrollment.ts"
import {
  Outreach,
  OutreachCampaign,
  OutreachContact,
  OutreachOwner,
} from "#/modules/marketing/model/outreach.ts"
import { defineModule } from "#/runtime/model/index.ts"

export const MarketingModule = defineModule({
  maturity: "alpha",
  origin: {
    name: "Company OS",
    url: "https://github.com/continual-ai/company-os",
  },
  description: "Plan campaigns, content, audiences, and outreach.",
  id: "marketing",
  name: "Marketing",
  objects: [Campaign, Content, Enrollment, Outreach],
  links: [
    CampaignOwner,
    ContentCampaign,
    ContentOwner,
    EnrollmentCampaign,
    EnrollmentContact,
    OutreachCampaign,
    OutreachContact,
    OutreachOwner,
  ],
})

export { Campaign, Content, Enrollment, Outreach }
