import { defineObject } from "@continual/runtime"

import { AuthorizationScope } from "#interfaces/authorization-scope"

export const RoleAssignment = defineObject({
  id: "roleAssignment",
  collection: "roleAssignments",
  name: "Role assignment",
  parent: AuthorizationScope,
  pluralName: "Role assignments",
  description: "One role granted to one principal at one authorization scope.",
  actions: { batchDelete: false, update: false },
  properties: {},
  display: { icon: "shieldCheck", title: "id" },
})
