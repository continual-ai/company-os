import { Actor } from "./interfaces/actor"
import { AuthorizationScope } from "./interfaces/authorization-scope"
import { Identity } from "./interfaces/identity"
import { Principal } from "./interfaces/principal"
import { GroupMembershipMember } from "./links/group-membership-member"
import { RoleAssignmentPrincipal } from "./links/role-assignment-principal"
import { RoleAssignmentRole } from "./links/role-assignment-role"
import { AnonymousActor } from "./objects/anonymous-actor"
import { Group } from "./objects/group"
import { GroupMembership } from "./objects/group-membership"
import { PrincipalSet } from "./objects/principal-set"
import { Role } from "./objects/role"
import { RoleAssignment } from "./objects/role-assignment"
import { ServiceAccount } from "./objects/service-account"
import { User } from "./objects/user"
import { Root } from "./root"

export const accessDefinitions = {
  actor: Actor,
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
  root: Root,
} as const
