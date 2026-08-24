import { defineLink } from "@continual/runtime"

import { Role } from "#objects/role"
import { RoleAssignment } from "#objects/role-assignment"

export const RoleAssignmentRole = defineLink({
  id: "roleAssignmentRole",
  name: "Role assignment role",
  forward: {
    from: RoleAssignment,
    to: Role,
    key: "role",
    label: "Role",
    cardinality: "one",
  },
  reverse: {
    from: Role,
    to: RoleAssignment,
    key: "assignments",
    label: "Assignments",
    cardinality: "many",
  },
})
