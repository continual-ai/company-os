import { defineModule } from "@company/runtime"

import { AnonymousActor } from "./anonymous-actor/model"
import { GroupMembership } from "./group-membership/model"
import { Group } from "./group/model"
import { Actor } from "./interfaces/actor"
import { AuthorizationScope } from "./interfaces/authorization-scope"
import { Identity } from "./interfaces/identity"
import { Principal } from "./interfaces/principal"
import { PrincipalSet } from "./principal-set/model"
import { RoleAssignment } from "./role-assignment/model"
import { Role } from "./role/model"
import { ServiceAccount } from "./service-account/model"
import { User } from "./user/model"

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
