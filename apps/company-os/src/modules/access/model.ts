import { defineModule } from "@company/runtime"

import { AnonymousActor } from "#/modules/access/anonymous-actor/model.ts"
import { GroupMembership } from "#/modules/access/group-membership/model.ts"
import { Group } from "#/modules/access/group/model.ts"
import { Actor } from "#/modules/access/interfaces/actor.ts"
import { AuthorizationScope } from "#/modules/access/interfaces/authorization-scope.ts"
import { Identity } from "#/modules/access/interfaces/identity.ts"
import { Principal } from "#/modules/access/interfaces/principal.ts"
import { PrincipalSet } from "#/modules/access/principal-set/model.ts"
import { RoleAssignment } from "#/modules/access/role-assignment/model.ts"
import { Role } from "#/modules/access/role/model.ts"
import { ServiceAccount } from "#/modules/access/service-account/model.ts"
import { User } from "#/modules/access/user/model.ts"

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
