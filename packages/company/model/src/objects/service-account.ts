import { defineObject, schema } from "@company/runtime"

import { Actor } from "#interfaces/actor"
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
    "The local projection of an identity used by software, integrations, and agents.",
  actions: {
    create: false,
    delete: false,
    batchDelete: false,
  },
  implements: [
    { interface: Actor },
    { interface: Identity },
    { interface: Principal },
  ],
  properties: {
    name: schema.string({ label: "Name", minLength: 1, maxLength: 200 }),
    description: schema.string({
      label: "Description",
      maxLength: 2_000,
      nullable: true,
    }),
    status: schema.select({
      label: "Status",
      default: "active",
      immutable: true,
      options: [
        { value: "active", label: "Active", color: "green" },
        { value: "disabled", label: "Disabled", color: "gray" },
      ],
    }),
  },
  display: {
    icon: "bot",
    status: "status",
    subtitle: "description",
    title: "name",
  },
})
