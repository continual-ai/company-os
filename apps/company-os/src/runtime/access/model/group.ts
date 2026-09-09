import { Principal } from "#/runtime/access/model/interfaces/principal.ts"
import { Root } from "#/runtime/access/model/root.ts"
import { defineObject, schema } from "#/runtime/model/index.ts"

export const Group = defineObject({
  id: "group",
  collection: "groups",
  name: "Group",
  parent: Root,
  pluralName: "Groups",
  description: "Manage access for a group of users and service accounts.",
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
