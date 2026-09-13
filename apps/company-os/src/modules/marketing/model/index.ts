import {
  CampaignMember,
  CampaignMemberCampaign,
  CampaignMemberContact,
} from "#/modules/marketing/model/campaign-member.ts"
import { Campaign, CampaignOwner } from "#/modules/marketing/model/campaign.ts"
import {
  Content,
  ContentCampaign,
  ContentOwner,
} from "#/modules/marketing/model/content.ts"
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
  objects: [Campaign, Content, CampaignMember, Outreach],
  links: [
    CampaignOwner,
    ContentCampaign,
    ContentOwner,
    CampaignMemberCampaign,
    CampaignMemberContact,
    OutreachCampaign,
    OutreachContact,
    OutreachOwner,
  ],
})

export { Campaign, Content, CampaignMember, Outreach }
