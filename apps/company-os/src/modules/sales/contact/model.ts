import { NoteSubject } from "@company/notes/note-subject"
import { defineObject, schema } from "@company/runtime"

import { Root } from "#/model-root.ts"
import { Party } from "#/modules/sales/interfaces/party.ts"

export const Contact = defineObject({
  id: "contact",
  collection: "contacts",
  name: "Contact",
  parent: Root,
  pluralName: "Contacts",
  description: "A customer, prospect, or partner you work with.",
  implements: [
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
    jobTitle: schema.string({
      label: "Job title",
      maxLength: 150,
      nullable: true,
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
  search: { fields: ["name", "email", "jobTitle", "phone"] },
  display: {
    icon: "person",
    image: "photo",
    title: "name",
    subtitle: "email",
  },
})
