import { defineInterface } from "@company/runtime"

export const Identity = defineInterface({
  id: "identity",
  name: "Identity",
  pluralName: "Identities",
  description:
    "A local User or ServiceAccount backed by authentication credentials.",
})
