import { defineObject, schema } from "@company/runtime"

import { AuthorizationScope } from "#modules/access/interfaces/authorization-scope"
import { Principal } from "#modules/access/interfaces/principal"
import { Role } from "#modules/access/role/model"

export const RoleAssignment = defineObject({
  id: "roleAssignment",
  collection: "roleAssignments",
  name: "Role assignment",
  parent: AuthorizationScope,
  pluralName: "Role assignments",
  description: "One role granted to one principal at one authorization scope.",
  actions: { batchDelete: false, update: false },
  properties: {
    principal: schema.reference(Principal, { label: "Principal" }),
    role: schema.reference(Role, { label: "Role" }),
  },
  uniqueBy: { assignment: ["parent", "principal", "role"] },
  display: { icon: "shieldCheck", title: "id" },
})
