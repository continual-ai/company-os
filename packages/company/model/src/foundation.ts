import { Actor } from "./interfaces/actor"
import { AuthorizationScope } from "./interfaces/authorization-scope"
import { Identity } from "./interfaces/identity"
import { Party } from "./interfaces/party"
import { Principal } from "./interfaces/principal"
import { GroupMembershipMember } from "./links/group-membership-member"
import { InvitationAcceptedBy } from "./links/invitation-accepted-by"
import { InvitationRole } from "./links/invitation-role"
import { RoleAssignmentPrincipal } from "./links/role-assignment-principal"
import { RoleAssignmentRole } from "./links/role-assignment-role"
import { AnonymousActor } from "./objects/anonymous-actor"
import { ApiKey } from "./objects/api-key"
import { Group } from "./objects/group"
import { GroupMembership } from "./objects/group-membership"
import { Invitation } from "./objects/invitation"
import { PrincipalSet } from "./objects/principal-set"
import { Role } from "./objects/role"
import { RoleAssignment } from "./objects/role-assignment"
import { ServiceAccount } from "./objects/service-account"
import { User } from "./objects/user"
import { Platform } from "./platform"

export const foundation = {
  actor: Actor,
  interfaces: [Actor, AuthorizationScope, Identity, Party, Principal],
  links: [
    GroupMembershipMember,
    RoleAssignmentPrincipal,
    RoleAssignmentRole,
    InvitationRole,
    InvitationAcceptedBy,
  ],
  objects: [
    User,
    ServiceAccount,
    AnonymousActor,
    ApiKey,
    Group,
    PrincipalSet,
    GroupMembership,
    Role,
    RoleAssignment,
    Invitation,
  ],
  root: Platform,
} as const
