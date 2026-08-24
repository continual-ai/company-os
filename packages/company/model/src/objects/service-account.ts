import { defineObject, schema } from "@company/runtime"

import { Identity } from "#interfaces/identity"
import { Principal } from "#interfaces/principal"
import { Platform } from "#platform"

export const ServiceAccount = defineObject({
  id: "serviceAccount",
  collection: "serviceAccounts",
  name: "Service account",
  parent: Platform,
  pluralName: "Service accounts",
  description:
    "A non-human identity used by software, integrations, and agents.",
  implements: [{ interface: Identity }, { interface: Principal }],
  properties: {
    name: schema.string({ label: "Name", minLength: 1, maxLength: 200 }),
    description: schema.string({
      label: "Description",
      maxLength: 2_000,
      nullable: true,
    }),
  },
  display: { icon: "bot", subtitle: "description", title: "name" },
})
