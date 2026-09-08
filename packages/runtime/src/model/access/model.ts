import { AnonymousActor } from "#/model/access/anonymous-actor/model.ts"
import { GroupMembership } from "#/model/access/group-membership/model.ts"
import { Group } from "#/model/access/group/model.ts"
import { Actor } from "#/model/access/interfaces/actor.ts"
import { AuthorizationScope } from "#/model/access/interfaces/authorization-scope.ts"
import { Identity } from "#/model/access/interfaces/identity.ts"
import { Principal } from "#/model/access/interfaces/principal.ts"
import { PrincipalSet } from "#/model/access/principal-set/model.ts"
import { RoleAssignment } from "#/model/access/role-assignment/model.ts"
import { Role } from "#/model/access/role/model.ts"
import { ServiceAccount } from "#/model/access/service-account/model.ts"
import { User } from "#/model/access/user/model.ts"
import { defineModule } from "#/model/index.ts"

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

export { Root } from "#/model/access/root.ts"

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
