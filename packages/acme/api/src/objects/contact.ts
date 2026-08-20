import { Root, defineObject, schema } from "@continual/runtime"

import { Company } from "./company"

export const Contact = defineObject({
  id: "contact",
  collection: "contacts",
  name: "Contact",
  parent: Root,
  pluralName: "Contacts",
  description: "A person Acme communicates or does business with.",
  properties: {
    photo: schema.image({ label: "Photo", aspectRatio: 1, nullable: true }),
    primaryCompanyId: schema.recordId(Company, {
      label: "Primary company",
      nullable: true,
      description:
        "The contact's primary company. Broader company associations are intentionally deferred.",
    }),
    firstName: schema.string({
      label: "First name",
      required: true,
      minLength: 1,
      maxLength: 100,
    }),
    lastName: schema.string({
      label: "Last name",
      required: true,
      minLength: 1,
      maxLength: 100,
    }),
    jobTitle: schema.string({ label: "Job title", maxLength: 150 }),
    email: schema.email({ label: "Email", maxLength: 320 }),
    phone: schema.phone({ label: "Phone", maxLength: 50 }),
  },
  display: {
    image: "photo",
    title: "lastName",
    subtitle: "email",
  },
})
