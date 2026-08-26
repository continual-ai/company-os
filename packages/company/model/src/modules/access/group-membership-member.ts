import { defineLink } from "@company/runtime"

import { GroupMembership } from "./group-membership"
import { Identity } from "./identity"

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
