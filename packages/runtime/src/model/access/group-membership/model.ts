import { Group } from "#/model/access/group/model.ts"
import { Identity } from "#/model/access/interfaces/identity.ts"
import { defineObject, schema } from "#/model/index.ts"

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
