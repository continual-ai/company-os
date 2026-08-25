import { defineLink } from "@company/runtime"

import { Invitation } from "#objects/invitation"
import { User } from "#objects/user"

export const InvitationAcceptedBy = defineLink({
  id: "invitationAcceptedBy",
  name: "Invitation accepted by",
  forward: {
    from: Invitation,
    to: User,
    key: "acceptedBy",
    label: "Accepted by",
    cardinality: "zeroOrOne",
  },
  reverse: {
    from: User,
    to: Invitation,
    key: "acceptedInvitations",
    label: "Accepted invitations",
    cardinality: "many",
  },
})
