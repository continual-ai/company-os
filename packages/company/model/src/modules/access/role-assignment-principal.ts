import { defineLink } from "@company/runtime"

import { Principal } from "./principal"
import { RoleAssignment } from "./role-assignment"

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
