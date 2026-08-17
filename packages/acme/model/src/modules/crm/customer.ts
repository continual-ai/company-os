import { defineObject, select, text, url } from "@continual/model"

export const Customer = defineObject({
  id: "customer",
  name: "Customer",
  pluralName: "Customers",
  description: "An organization Acme serves or is preparing to serve.",
  fields: {
    name: text({ required: true }),
    legalName: text(),
    website: url(),
    status: select({
      required: true,
      options: [
        { value: "prospect", label: "Prospect" },
        { value: "active", label: "Active" },
        { value: "inactive", label: "Inactive" },
      ],
    }),
  },
  display: {
    title: "name",
    subtitle: "legalName",
    status: "status",
  },
})
