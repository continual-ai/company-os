import { defineInterface } from "@company/runtime"

export const Identity = defineInterface({
  id: "identity",
  name: "Identity",
  pluralName: "Identities",
  description:
    "A User or ServiceAccount that may act in this operating system.",
})
