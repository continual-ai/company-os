import { defineInterface } from "@company/runtime"

export const Identity = defineInterface({
  id: "identity",
  name: "Identity",
  pluralName: "Identities",
  description:
    "A canonical local User or ServiceAccount resolved by a trusted authentication boundary.",
})
