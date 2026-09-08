import { defineInterface } from "#/model/index.ts"

export const Principal = defineInterface({
  id: "principal",
  name: "Principal",
  pluralName: "Principals",
  description:
    "A user, service account, group, or audience that can receive access.",
})
