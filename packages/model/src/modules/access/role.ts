import { defineObject, schema } from "@company/runtime"

import { Root } from "#root"

export const Role = defineObject({
  id: "role",
  collection: "roles",
  name: "Role",
  parent: Root,
  pluralName: "Roles",
  description: "A set of exact permissions assignable at one scope type.",
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
    permissions: schema.array(schema.string({ minLength: 1, maxLength: 200 }), {
      label: "Permissions",
    }),
  },
  display: { icon: "shield", subtitle: "description", title: "name" },
})
