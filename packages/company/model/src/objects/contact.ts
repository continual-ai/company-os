import { defineObject, schema } from "@company/runtime"

import { Party } from "#interfaces/party"
import { Platform } from "#platform"

export const Contact = defineObject({
  id: "contact",
  collection: "contacts",
  name: "Contact",
  parent: Platform,
  pluralName: "Contacts",
  description: "A person associated with business activity.",
  implements: [
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
    phone: schema.phone({ label: "Phone", maxLength: 50, nullable: true }),
  },
  display: {
    icon: "person",
    image: "photo",
    title: "name",
    subtitle: "email",
  },
})
