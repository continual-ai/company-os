import { defineObject, field } from "@continual/runtime"

import { Company } from "./company"

export const Contact = defineObject({
  id: "contact",
  collection: "contacts",
  name: "Contact",
  pluralName: "Contacts",
  description: "A person Acme communicates or does business with.",
  fields: {
    photo: field.image({ label: "Photo", aspectRatio: 1, nullable: true }),
    primaryCompanyId: field.reference({
      object: Company,
      label: "Primary company",
      nullable: true,
      description:
        "The contact's primary company. Broader company associations are intentionally deferred.",
    }),
    firstName: field.text({
      label: "First name",
      required: true,
      minLength: 1,
      maxLength: 100,
    }),
    lastName: field.text({
      label: "Last name",
      required: true,
      minLength: 1,
      maxLength: 100,
    }),
    jobTitle: field.text({ label: "Job title", maxLength: 150 }),
    email: field.email({ label: "Email", maxLength: 320 }),
    phone: field.phone({ label: "Phone", maxLength: 50 }),
  },
  display: {
    image: "photo",
    title: "lastName",
    subtitle: "email",
  },
})
