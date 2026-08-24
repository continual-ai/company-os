import { defineObject, schema } from "@continual/runtime"

import { Platform } from "#platform"

export const Role = defineObject({
  id: "role",
  collection: "roles",
  name: "Role",
  parent: Platform,
  pluralName: "Roles",
  description:
    "A source-owned set of exact permissions assignable at one scope type.",
  actions: { create: false, delete: false, update: false },
  properties: {
    name: schema.string({ label: "Name", minLength: 1, maxLength: 200 }),
    description: schema.string({
      label: "Description",
      maxLength: 2_000,
      nullable: true,
    }),
    scopeType: schema.string({
      label: "Scope type",
      minLength: 1,
      maxLength: 100,
    }),
    permissions: schema.array(schema.string({ minLength: 1, maxLength: 200 })),
  },
  display: { icon: "shield", subtitle: "description", title: "name" },
})
