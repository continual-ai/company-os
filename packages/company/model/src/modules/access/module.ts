import { defineModule } from "@company/runtime"

import { Actor } from "./actor"
import { AnonymousActor } from "./anonymous-actor"
import { AuthorizationScope } from "./authorization-scope"
import { Group } from "./group"
import { GroupMembership } from "./group-membership"
import { GroupMembershipMember } from "./group-membership-member"
import { Identity } from "./identity"
import { Principal } from "./principal"
import { PrincipalSet } from "./principal-set"
import { Role } from "./role"
import { RoleAssignment } from "./role-assignment"
import { RoleAssignmentPrincipal } from "./role-assignment-principal"
import { RoleAssignmentRole } from "./role-assignment-role"
import { ServiceAccount } from "./service-account"
import { User } from "./user"

export const AccessModule = defineModule({
  id: "access",
  name: "Access",
  interfaces: [Actor, AuthorizationScope, Identity, Principal],
  links: [GroupMembershipMember, RoleAssignmentPrincipal, RoleAssignmentRole],
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
