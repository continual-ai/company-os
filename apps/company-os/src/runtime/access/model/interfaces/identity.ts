import { defineInterface } from "#/runtime/model/index.ts"

export const Identity = defineInterface({
  id: "identity",
  name: "Identity",
  pluralName: "Identities",
  description: "A signed-in user or authenticated service account.",
})
