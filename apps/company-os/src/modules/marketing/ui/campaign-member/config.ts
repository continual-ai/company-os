import { Model } from "#/app.model.ts"
import { CampaignMember } from "#/modules/marketing/model/campaign-member.ts"
import { defineCollectionView, type ObjectUi } from "#/runtime/ui/module.ts"

export const campaignMemberUi = {
  collection: {
    views: [
      defineCollectionView(
        Model,
        CampaignMember,
        "all",
        "All campaign members",
        {
          columns: ["label", "contact", "campaign", "status", "nextTouchAt"],
        }
      ),
      defineCollectionView(Model, CampaignMember, "active", "Active", {
        columns: ["label", "contact", "campaign", "status", "nextTouchAt"],
        filters: [
          { id: "status", value: { operator: "equals", values: ["active"] } },
        ],
      }),
      defineCollectionView(Model, CampaignMember, "queued", "Queued", {
        columns: ["label", "contact", "campaign", "status", "nextTouchAt"],
        filters: [
          { id: "status", value: { operator: "equals", values: ["queued"] } },
        ],
      }),
    ],
  },
} satisfies ObjectUi<typeof CampaignMember>
