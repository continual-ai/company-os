import { AuthorizationScope } from "#/model/access/interfaces/authorization-scope.ts"
import { Principal } from "#/model/access/interfaces/principal.ts"
import { Role } from "#/model/access/role/model.ts"
import { defineObject, schema } from "#/model/index.ts"

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
