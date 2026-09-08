import { defineObject, schema } from "@company/runtime"

import { AuthorizationScope } from "#/modules/access/interfaces/authorization-scope.ts"
import { Principal } from "#/modules/access/interfaces/principal.ts"
import { Role } from "#/modules/access/role/model.ts"

export const RoleAssignment = defineObject({
  id: "roleAssignment",
  collection: "roleAssignments",
  name: "Role assignment",
  parent: AuthorizationScope,
  pluralName: "Role assignments",
  description: "Give a user, group, or service account a role on a resource.",
  actions: { batchDelete: false, update: false },
  properties: {
    principal: schema.reference(Principal, { label: "Principal" }),
    role: schema.reference(Role, { label: "Role" }),
  },
  uniqueBy: { assignment: ["parent", "principal", "role"] },
  display: { icon: "shieldCheck", title: "id" },
})
