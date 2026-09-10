import { Campaign } from "#/modules/marketing/model/campaign.ts"
import { NoteSubject } from "#/modules/notes/model/index.ts"
import { User } from "#/runtime/access/model/index.ts"
import { defineObject, schema } from "#/runtime/model/index.ts"

export const Content = defineObject({
  id: "content",
  collection: "contents",
  name: "Content",
  pluralName: "Content",
  description: "Track an article, post, or ad. Saving does not publish it.",
  implements: [{ interface: NoteSubject }],
  properties: {
    title: schema.string({ label: "Title", maxLength: 300, minLength: 1 }),
    campaign: schema.reference(Campaign, {
      label: "Campaign",
      nullable: true,
      inverse: { key: "content", label: "Content" },
    }),
    format: schema.select({
      label: "Format",
      default: "article",
      options: [
        { value: "article", label: "Article" },
        { value: "social", label: "Social post" },
        { value: "email", label: "Email" },
        { value: "ad", label: "Ad creative" },
        { value: "landingPage", label: "Landing page" },
      ],
    }),
    status: schema.select({
      label: "Status",
      default: "draft",
      options: [
        { value: "draft", label: "Draft" },
        { value: "review", label: "In review" },
        { value: "approved", label: "Approved" },
        { value: "scheduled", label: "Scheduled" },
        { value: "published", label: "Published" },
        { value: "archived", label: "Archived" },
      ],
    }),
    owner: schema.reference(User, {
      label: "Owner",
      nullable: true,
      inverse: { key: "content", label: "Content" },
    }),
    brief: schema.string({ label: "Brief", maxLength: 20000, nullable: true }),
    body: schema.markdown({ label: "Body", maxLength: 100000, nullable: true }),
    scheduledAt: schema.timestamp({ label: "Scheduled for", nullable: true }),
    publishedUrl: schema.url({ label: "Published URL", nullable: true }),
    attachments: schema.array(schema.file({ maxBytes: 25_000_000 }), {
      label: "Attachments",
      default: [],
    }),
  },
  search: { fields: ["title", "brief", "body"] },
  display: { title: "title", icon: "fileText", status: "status" },
})
