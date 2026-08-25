import { defineObject, schema } from "@company/runtime"

import { Identity } from "#interfaces/identity"
import { Principal } from "#interfaces/principal"
import { Platform } from "#platform"

export const User = defineObject({
  id: "user",
  collection: "users",
  name: "User",
  parent: Platform,
  pluralName: "Users",
  description: "A person with authenticated access to this operating system.",
  implements: [{ interface: Identity }, { interface: Principal }],
  properties: {
    name: schema.string({ label: "Name", minLength: 1, maxLength: 200 }),
    email: schema.email({ label: "Email", maxLength: 320 }),
    image: schema.image({ label: "Image", aspectRatio: 1, nullable: true }),
  },
  uniqueBy: { email: ["email"] },
  display: { icon: "person", image: "image", subtitle: "email", title: "name" },
})
