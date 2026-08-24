import { defineModel, type RecordIdOf } from "@continual/runtime"

import { AuthorizationScope } from "./interfaces/authorization-scope"
import { Identity } from "./interfaces/identity"
import { Party } from "./interfaces/party"
import { Principal } from "./interfaces/principal"
import { ContactPrimaryCompany } from "./links/contact-primary-company"
import { DealCompany } from "./links/deal-company"
import { GroupMembershipMember } from "./links/group-membership-member"
import { InteractionSubject } from "./links/interaction-subject"
import { RoleAssignmentPrincipal } from "./links/role-assignment-principal"
import { RoleAssignmentRole } from "./links/role-assignment-role"
import { Company } from "./objects/company"
import { Contact } from "./objects/contact"
import { Deal } from "./objects/deal"
import { Group } from "./objects/group"
import { GroupMembership } from "./objects/group-membership"
import { Interaction } from "./objects/interaction"
import { Lead } from "./objects/lead"
import { LineItem } from "./objects/line-item"
import { Role } from "./objects/role"
import { RoleAssignment } from "./objects/role-assignment"
import { ServiceAccount } from "./objects/service-account"
import { User } from "./objects/user"
import { Platform } from "./platform"

export const AcmeModel = defineModel({
  actor: Identity,
  id: "acme",
  name: "Acme",
  interfaces: [AuthorizationScope, Identity, Party, Principal],
  objects: [
    User,
    ServiceAccount,
    Group,
    GroupMembership,
    Role,
    RoleAssignment,
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
    ContactPrimaryCompany,
    DealCompany,
    InteractionSubject,
  ],
  root: Platform,
})

/** Canonical ID of a user or service account that may act in Acme. */
export type IdentityId = RecordIdOf<typeof AcmeModel, typeof Identity>

/** Canonical ID of an identity or group that may receive a role assignment. */
export type PrincipalId = RecordIdOf<typeof AcmeModel, typeof Principal>
