import { AnonymousActor } from "#/runtime/access/model/anonymous-actor.ts"
import { GroupMembership } from "#/runtime/access/model/group-membership.ts"
import { Group } from "#/runtime/access/model/group.ts"
import { Identity } from "#/runtime/access/model/interfaces/identity.ts"
import { Principal } from "#/runtime/access/model/interfaces/principal.ts"
import { PrincipalSet } from "#/runtime/access/model/principal-set.ts"
import { RoleAssignment } from "#/runtime/access/model/role-assignment.ts"
import { Role } from "#/runtime/access/model/role.ts"
import { ServiceAccount } from "#/runtime/access/model/service-account.ts"
import { User } from "#/runtime/access/model/user.ts"
import { defineModule } from "#/runtime/model/index.ts"

/** Kernel module that implements the model's Actor, Identity, and Principal roles. */
export const AccessModule = defineModule({
  description: "Manage identities, groups, roles, and permissions.",
  id: "access",
  name: "Access",
  interfaces: [Identity, Principal],
  objects: [
    User,
    ServiceAccount,
    AnonymousActor,
    Group,
    PrincipalSet,
    GroupMembership,
    Role,
    RoleAssignment,
  ],
})

export {
  Role,
  PrincipalSet,
  Group,
  User,
  RoleAssignment,
  ServiceAccount,
  AnonymousActor,
  GroupMembership,
  Identity,
  Principal,
}
