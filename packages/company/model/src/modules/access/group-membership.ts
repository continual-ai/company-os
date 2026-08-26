import { defineObject } from "@company/runtime"

import { Group } from "./group"

export const GroupMembership = defineObject({
  id: "groupMembership",
  collection: "groupMemberships",
  name: "Group membership",
  parent: Group,
  pluralName: "Group memberships",
  description: "One identity's membership in a group.",
  actions: { update: false },
  properties: {},
  uniqueBy: { membership: ["parent", "member"] },
  display: { icon: "userRoundPlus", title: "id" },
})
