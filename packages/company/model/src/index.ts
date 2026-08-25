import { defineModel, type RecordIdOf } from "@company/runtime"

import { AuthorizationScope } from "./interfaces/authorization-scope"
import { Identity } from "./interfaces/identity"
import { Party } from "./interfaces/party"
import { Principal } from "./interfaces/principal"
import { ContactPrimaryCompany } from "./links/contact-primary-company"
import { GroupMembershipMember } from "./links/group-membership-member"
import { InteractionSubject } from "./links/interaction-subject"
import { InvitationAcceptedBy } from "./links/invitation-accepted-by"
import { InvitationRole } from "./links/invitation-role"
import { RoleAssignmentPrincipal } from "./links/role-assignment-principal"
import { RoleAssignmentRole } from "./links/role-assignment-role"
import { modelMetadata } from "./metadata"
import { ApiKey } from "./objects/api-key"
import { Company } from "./objects/company"
import { Contact } from "./objects/contact"
import { Deal } from "./objects/deal"
import { Group } from "./objects/group"
import { GroupMembership } from "./objects/group-membership"
import { Interaction } from "./objects/interaction"
import { Invitation } from "./objects/invitation"
import { Lead } from "./objects/lead"
import { LineItem } from "./objects/line-item"
import { Role } from "./objects/role"
import { RoleAssignment } from "./objects/role-assignment"
import { ServiceAccount } from "./objects/service-account"
import { User } from "./objects/user"
import { Platform } from "./platform"

export const Model = defineModel({
  actor: Identity,
  id: "operatingSystem",
  name: modelMetadata.name,
  interfaces: [AuthorizationScope, Identity, Party, Principal],
  objects: [
    User,
    ServiceAccount,
    ApiKey,
    Group,
    GroupMembership,
    Role,
    RoleAssignment,
    Invitation,
    Company,
    Contact,
    Lead,
    Deal,
    LineItem,
    Interaction,
  ],
  links: [
    GroupMembershipMember,
    RoleAssignmentPrincipal,
    RoleAssignmentRole,
    InvitationRole,
    InvitationAcceptedBy,
    ContactPrimaryCompany,
    InteractionSubject,
  ],
  root: Platform,
})

/** Canonical ID of a user or service account that may act in this model. */
export type IdentityId = RecordIdOf<typeof Model, typeof Identity>

/** Canonical ID of an identity or group that may receive a role assignment. */
export type PrincipalId = RecordIdOf<typeof Model, typeof Principal>
