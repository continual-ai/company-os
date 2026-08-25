import { defineLink } from "@company/runtime"

import { Invitation } from "#objects/invitation"
import { Role } from "#objects/role"

export const InvitationRole = defineLink({
  id: "invitationRole",
  name: "Invitation role",
  forward: {
    from: Invitation,
    to: Role,
    key: "role",
    label: "Role",
    cardinality: "one",
  },
  reverse: {
    from: Role,
    to: Invitation,
    key: "invitations",
    label: "Invitations",
    cardinality: "many",
  },
})
