import { AnonymousActor } from "#/runtime/access/model/anonymous-actor.ts"
import { GroupMembership } from "#/runtime/access/model/group-membership.ts"
import { Group } from "#/runtime/access/model/group.ts"
import { Actor } from "#/runtime/access/model/interfaces/actor.ts"
import { AuthorizationScope } from "#/runtime/access/model/interfaces/authorization-scope.ts"
import { Identity } from "#/runtime/access/model/interfaces/identity.ts"
import { Principal } from "#/runtime/access/model/interfaces/principal.ts"
import { PrincipalSet } from "#/runtime/access/model/principal-set.ts"
import { RoleAssignment } from "#/runtime/access/model/role-assignment.ts"
import { Role } from "#/runtime/access/model/role.ts"
import { ServiceAccount } from "#/runtime/access/model/service-account.ts"
import { User } from "#/runtime/access/model/user.ts"
import { defineModule } from "#/runtime/model/index.ts"

export const AccessModule = defineModule({
  id: "access",
  name: "Access",
  interfaces: [Actor, AuthorizationScope, Identity, Principal],
  links: [],
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

export { Root } from "#/runtime/access/model/root.ts"

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
  Actor,
  AuthorizationScope,
  Principal,
}
