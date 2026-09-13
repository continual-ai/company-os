import { Contact } from "#/modules/crm/model/index.ts"
import { Campaign } from "#/modules/marketing/model/campaign.ts"
import { NoteSubject } from "#/modules/notes/model/index.ts"
import { defineLink, defineObject, schema } from "#/runtime/model/index.ts"

export const CampaignMember = defineObject({
  id: "campaignMember",
  collection: "campaignMembers",
  name: "Campaign member",
  pluralName: "Campaign members",
  description: "Track a contact's progress and next follow-up in a campaign.",
  implements: [{ interface: NoteSubject }],
  properties: {
    status: schema.select({
      label: "Status",
      default: "queued",
      options: [
        { value: "queued", label: "Queued" },
        { value: "active", label: "Active" },
        { value: "paused", label: "Paused" },
        { value: "completed", label: "Completed" },
        { value: "unsubscribed", label: "Unsubscribed" },
      ],
    }),
    step: schema.number({
      label: "Current step",
      integer: true,
      minimum: 0,
      default: 0,
    }),
    nextTouchAt: schema.timestamp({ label: "Next touch", nullable: true }),
    context: schema.string({
      label: "Context",
      maxLength: 10000,
      nullable: true,
    }),
  },
  uniqueBy: { membership: ["campaign", "contact"] },
  search: { fields: ["context"] },
  display: {
    title: ["contact.name", "campaign.name"],
    icon: "users",
    status: "status",
  },
})

export const CampaignMemberCampaign = defineLink({
  id: "campaignMemberCampaign",
  name: "Campaign member Campaign",
  from: {
    type: CampaignMember,
    key: "campaign",
    label: "Campaign",
    min: 1,
    max: 1,
  },
  to: { type: Campaign, key: "campaignMembers", label: "Campaign members" },
})

export const CampaignMemberContact = defineLink({
  id: "campaignMemberContact",
  name: "Campaign member Contact",
  from: {
    type: CampaignMember,
    key: "contact",
    label: "Contact",
    min: 1,
    max: 1,
  },
  to: { type: Contact, key: "campaignMembers", label: "Campaign members" },
})
