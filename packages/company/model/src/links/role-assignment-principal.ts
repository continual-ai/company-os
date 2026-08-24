import { defineLink } from "@company/runtime"

import { Principal } from "#interfaces/principal"
import { RoleAssignment } from "#objects/role-assignment"

export const RoleAssignmentPrincipal = defineLink({
  id: "roleAssignmentPrincipal",
  name: "Role assignment principal",
  forward: {
    from: RoleAssignment,
    to: Principal,
    key: "principal",
    label: "Principal",
    cardinality: "one",
  },
  reverse: {
    from: Principal,
    to: RoleAssignment,
    key: "roleAssignments",
    label: "Role assignments",
    cardinality: "many",
  },
})
