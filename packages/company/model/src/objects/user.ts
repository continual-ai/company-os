import { defineObject, schema } from "@company/runtime"

import { Actor } from "#interfaces/actor"
import { Identity } from "#interfaces/identity"
import { Principal } from "#interfaces/principal"
import { Platform } from "#platform"

export const User = defineObject({
  id: "user",
  collection: "users",
  name: "User",
  parent: Platform,
  pluralName: "Users",
  description:
    "The local projection of a person resolved by the deployment identity provider.",
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
    email: schema.email({ label: "Email", maxLength: 320, immutable: true }),
    image: schema.image({ label: "Image", aspectRatio: 1, nullable: true }),
    status: schema.select({
      label: "Status",
      default: "active",
      immutable: true,
      options: [
        { value: "active", label: "Active", color: "green" },
        { value: "suspended", label: "Suspended", color: "gray" },
      ],
    }),
  },
  uniqueBy: { email: ["email"] },
  display: {
    icon: "person",
    image: "image",
    status: "status",
    subtitle: "email",
    title: "name",
  },
})
