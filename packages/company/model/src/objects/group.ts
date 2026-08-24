import { defineObject, schema } from "@company/runtime"

import { Principal } from "#interfaces/principal"
import { Platform } from "#platform"

export const Group = defineObject({
  id: "group",
  collection: "groups",
  name: "Group",
  parent: Platform,
  pluralName: "Groups",
  description: "A principal that grants the same access to several identities.",
  implements: [{ interface: Principal }],
  properties: {
    name: schema.string({ label: "Name", minLength: 1, maxLength: 200 }),
    description: schema.string({
      label: "Description",
      maxLength: 2_000,
      nullable: true,
    }),
  },
  display: { icon: "users", subtitle: "description", title: "name" },
})
