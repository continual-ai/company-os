import { defineLink } from "@company/runtime"

import { Identity } from "#interfaces/identity"
import { GroupMembership } from "#objects/group-membership"

export const GroupMembershipMember = defineLink({
  id: "groupMembershipMember",
  name: "Group membership member",
  forward: {
    from: GroupMembership,
    to: Identity,
    key: "member",
    label: "Member",
    cardinality: "one",
  },
  reverse: {
    from: Identity,
    to: GroupMembership,
    key: "groupMemberships",
    label: "Group memberships",
    cardinality: "many",
  },
})
