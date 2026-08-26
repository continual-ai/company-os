import { defineInterface } from "@company/runtime"

export const Principal = defineInterface({
  id: "principal",
  name: "Principal",
  pluralName: "Principals",
  description:
    "An identity, group, or system-defined principal set that may receive a role assignment.",
})
