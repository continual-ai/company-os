import { Identity } from "#/runtime/access/model/interfaces/identity.ts"
import { defineObject, schema, Actor } from "#/runtime/model/index.ts"

export const User = defineObject({
  id: "user",
  collection: "users",
  name: "User",
  pluralName: "Users",
  description: "Someone who can sign in and use this application.",
  actions: { create: false, delete: false, batchDelete: false, update: false },
  implements: [{ interface: Actor }, { interface: Identity }],
  properties: {
    name: schema.string({ label: "Name", minLength: 1, maxLength: 200 }),
    email: schema.email({ label: "Email", maxLength: 320 }),
    image: schema.image({ label: "Image", aspectRatio: 1, nullable: true }),
  },
  display: {
    icon: "person",
    image: "image",
    subtitle: "email",
    title: "name",
  },
})
