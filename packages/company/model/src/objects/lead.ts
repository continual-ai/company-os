import { defineObject, schema } from "@company/runtime"

import { Platform } from "#platform"

export const Lead = defineObject({
  id: "lead",
  collection: "leads",
  name: "Lead",
  parent: Platform,
  pluralName: "Leads",
  description:
    "An unqualified person or organization that may become a customer.",
  properties: {
    name: schema.string({
      label: "Name",
      minLength: 1,
      maxLength: 200,
    }),
    companyName: schema.string({
      label: "Company",
      minLength: 1,
      maxLength: 200,
    }),
    email: schema.email({ label: "Email", maxLength: 320, nullable: true }),
    phone: schema.phone({ label: "Phone", maxLength: 50, nullable: true }),
    source: schema.select({
      label: "Source",
      default: "unknown",
      options: [
        { value: "unknown", label: "Unknown" },
        { value: "inbound", label: "Inbound" },
        { value: "outbound", label: "Outbound" },
        { value: "referral", label: "Referral" },
        { value: "other", label: "Other" },
      ],
    }),
    status: schema.select({
      label: "Status",
      default: "new",
      options: [
        { value: "new", label: "New" },
        { value: "working", label: "Working" },
        { value: "qualified", label: "Qualified" },
        { value: "disqualified", label: "Disqualified" },
      ],
    }),
  },
  display: {
    icon: "lead",
    title: "name",
    subtitle: "companyName",
    status: "status",
  },
})
