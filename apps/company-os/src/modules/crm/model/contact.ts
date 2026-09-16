import { Party } from "#/modules/crm/model/interfaces/party.ts"
import { defineObject, schema } from "#/runtime/model/index.ts"
import { ControllerTarget } from "#/runtime/platform/model/controller-instance.ts"
import { NoteSubject } from "#/runtime/platform/model/note-subject.ts"

export const Contact = defineObject({
  id: "contact",
  collection: "contacts",
  name: "Contact",
  pluralName: "Contacts",
  description: "A customer, prospect, or partner you work with.",
  implements: [
    { interface: ControllerTarget },
    { interface: NoteSubject },
    {
      interface: Party,
      propertyMapping: { image: "photo", name: "name" },
    },
  ],
  properties: {
    photo: schema.image({ label: "Photo", aspectRatio: 1, nullable: true }),
    name: schema.string({
      label: "Name",
      minLength: 1,
      maxLength: 200,
    }),
    summary: schema.markdown({
      label: "Summary",
      nullable: true,
      maxLength: 10_000,
      description:
        "An agent-maintained summary of this person's background and current relationship context, with sources where available.",
    }),
    relationshipStrength: schema.score({
      label: "Relationship strength",
      nullable: true,
      description:
        "Manual assessment of your team’s relationship with this person, from 0 (no established relationship) to 100 (strong, active relationship).",
    }),
    email: schema.email({ label: "Email", maxLength: 320, nullable: true }),
    marketingStatus: schema.select({
      label: "Marketing status",
      description:
        "Choose whether to include this person in marketing audiences.",
      default: "nonMarketing",
      options: [
        { value: "nonMarketing", label: "Non-marketing contact" },
        { value: "marketing", label: "Marketing contact" },
      ],
    }),
    emailPermission: schema.select({
      label: "Marketing email consent",
      description:
        "Record permission to send marketing emails. Marketing status alone is not consent.",
      default: "unknown",
      options: [
        { value: "unknown", label: "Not recorded" },
        { value: "optedIn", label: "Opted in" },
        { value: "optedOut", label: "Opted out" },
      ],
    }),
    phone: schema.phone({ label: "Phone", maxLength: 50, nullable: true }),
  },
  search: { fields: ["name", "email", "phone"] },
  display: {
    icon: "person",
    image: "photo",
    title: "name",
    subtitle: "email",
  },
})
