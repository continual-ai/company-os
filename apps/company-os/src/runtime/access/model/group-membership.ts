import { Group } from "#/runtime/access/model/group.ts"
import { Identity } from "#/runtime/access/model/interfaces/identity.ts"
import { defineObject, schema } from "#/runtime/model/index.ts"

export const GroupMembership = defineObject({
  id: "groupMembership",
  collection: "groupMemberships",
  name: "Group membership",
  parent: Group,
  pluralName: "Group memberships",
  description: "Add a user or service account to a group.",
  actions: { update: false },
  properties: {
    member: schema.reference(Identity, { label: "Member" }),
  },
  uniqueBy: { membership: ["parent", "member"] },
  display: { icon: "userRoundPlus", title: "id" },
})
