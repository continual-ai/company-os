import { Root, defineObject, schema } from "@continual/runtime"

import { Party } from "#interfaces/party"

export const Contact = defineObject({
  id: "contact",
  collection: "contacts",
  name: "Contact",
  parent: Root,
  pluralName: "Contacts",
  description: "A person Acme communicates or does business with.",
  implements: [
    {
      interface: Party,
      properties: { image: "photo", name: "name" },
    },
  ],
  properties: {
    photo: schema.image({ label: "Photo", aspectRatio: 1, nullable: true }),
    firstName: schema.string({
      label: "First name",
      minLength: 1,
      maxLength: 100,
    }),
    lastName: schema.string({
      label: "Last name",
      minLength: 1,
      maxLength: 100,
    }),
    name: schema.string({
      label: "Name",
      outputOnly: true,
      description: "The contact's generated full display name.",
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
