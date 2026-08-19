import { defineObject, field } from "@continual/runtime"

export const Lead = defineObject({
  id: "lead",
  collection: "leads",
  name: "Lead",
  pluralName: "Leads",
  description:
    "An unqualified person or organization that may become a customer.",
  fields: {
    name: field.text({
      label: "Name",
      required: true,
      minLength: 1,
      maxLength: 200,
    }),
    companyName: field.text({
      label: "Company",
      required: true,
      minLength: 1,
      maxLength: 200,
    }),
    email: field.email({ label: "Email", maxLength: 320 }),
    phone: field.phone({ label: "Phone", maxLength: 50 }),
    source: field.select({
      label: "Source",
      defaultValue: "unknown",
      options: [
        { value: "unknown", label: "Unknown" },
        { value: "inbound", label: "Inbound" },
        { value: "outbound", label: "Outbound" },
        { value: "referral", label: "Referral" },
        { value: "other", label: "Other" },
      ],
    }),
    status: field.select({
      label: "Status",
      defaultValue: "new",
      options: [
        { value: "new", label: "New" },
        { value: "working", label: "Working" },
        { value: "qualified", label: "Qualified" },
        { value: "disqualified", label: "Disqualified" },
      ],
    }),
  },
  display: {
    title: "name",
    subtitle: "companyName",
    status: "status",
  },
})
