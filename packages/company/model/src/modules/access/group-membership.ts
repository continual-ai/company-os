import { defineObject, schema } from "@company/runtime"

import { Group } from "./group"
import { Identity } from "./identity"

export const GroupMembership = defineObject({
  id: "groupMembership",
  collection: "groupMemberships",
  name: "Group membership",
  parent: Group,
  pluralName: "Group memberships",
  description: "One identity's membership in a group.",
  actions: { update: false },
  properties: {
    member: schema.recordId(Identity, { label: "Member" }),
  },
  uniqueBy: { membership: ["parent", "member"] },
  display: { icon: "userRoundPlus", title: "id" },
})
