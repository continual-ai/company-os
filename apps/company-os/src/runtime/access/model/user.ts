import { Actor } from "#/runtime/access/model/interfaces/actor.ts"
import { Identity } from "#/runtime/access/model/interfaces/identity.ts"
import { Principal } from "#/runtime/access/model/interfaces/principal.ts"
import { Root } from "#/runtime/access/model/root.ts"
import { defineObject, schema } from "#/runtime/model/index.ts"

export const User = defineObject({
  id: "user",
  collection: "users",
  name: "User",
  parent: Root,
  pluralName: "Users",
  description: "Someone who can sign in and use this application.",
  actions: {
    create: false,
    delete: false,
    batchDelete: false,
    update: false,
  },
  implements: [
    { interface: Actor },
    { interface: Identity },
    { interface: Principal },
  ],
  properties: {
    name: schema.string({ label: "Name", minLength: 1, maxLength: 200 }),
    email: schema.email({ label: "Email", maxLength: 320 }),
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
  display: {
    icon: "person",
    image: "image",
    status: "status",
    subtitle: "email",
    title: "name",
  },
})
