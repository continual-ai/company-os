import { defineInterface } from "@continual/runtime"

export const Principal = defineInterface({
  id: "principal",
  name: "Principal",
  pluralName: "Principals",
  description: "An identity or group that may receive a role assignment.",
})
