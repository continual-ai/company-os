import { defineModule } from "@company/runtime"

import { Actor } from "./actor"
import { AnonymousActor } from "./anonymous-actor"
import { AuthorizationScope } from "./authorization-scope"
import { Group } from "./group"
import { GroupMembership } from "./group-membership"
import { Identity } from "./identity"
import { Principal } from "./principal"
import { PrincipalSet } from "./principal-set"
import { Role } from "./role"
import { RoleAssignment } from "./role-assignment"
import { ServiceAccount } from "./service-account"
import { User } from "./user"

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
