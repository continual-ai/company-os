import { defineObject, schema, standardErrors } from "@company/runtime"

import { AuthorizationScope } from "#interfaces/authorization-scope"
import { Role } from "#objects/role"

const InvitationReference = { id: "invitation" } as const
const UserReference = { id: "user" } as const

export const Invitation = defineObject({
  id: "invitation",
  collection: "invitations",
  name: "Invitation",
  parent: AuthorizationScope,
  pluralName: "Invitations",
  description:
    "An expiring offer for a verified User to receive one role at one scope.",
  actions: {
    create: false,
    update: false,
    delete: false,
    batchDelete: false,
    issue: {
      name: "Issue invitation",
      description:
        "Creates an invitation and its single-use redemption secret.",
      scope: "collection",
      input: {
        email: schema.email({ maxLength: 320 }),
        expiresAt: schema.timestamp(),
        role: schema.recordId(Role),
        scope: schema.recordId(AuthorizationScope),
      },
      output: {
        invitation: schema.recordId(InvitationReference),
        redemptionToken: schema.string({ minLength: 1 }),
      },
      errors: [
        standardErrors.failedPrecondition,
        standardErrors.permissionDenied,
      ],
    },
    accept: {
      name: "Accept invitation",
      description:
        "Consumes an invitation for the authenticated verified email and grants its role.",
      scope: "object",
      input: { redemptionToken: schema.string({ minLength: 1 }) },
      output: { user: schema.recordId(UserReference) },
      errors: [
        standardErrors.failedPrecondition,
        standardErrors.notFound,
        standardErrors.unauthenticated,
      ],
    },
    revoke: {
      name: "Revoke invitation",
      description: "Prevents a pending invitation from being accepted.",
      destructive: true,
      idempotent: true,
      scope: "object",
      errors: [standardErrors.notFound, standardErrors.permissionDenied],
    },
  },
  properties: {
    email: schema.email({ label: "Email", maxLength: 320 }),
    expiresAt: schema.timestamp({ label: "Expires at" }),
    acceptedAt: schema.timestamp({ label: "Accepted at", nullable: true }),
    revokedAt: schema.timestamp({ label: "Revoked at", nullable: true }),
    status: schema.select({
      label: "Status",
      default: "pending",
      options: [
        { value: "pending", label: "Pending", color: "blue" },
        { value: "accepted", label: "Accepted", color: "green" },
        { value: "revoked", label: "Revoked", color: "gray" },
      ],
    }),
  },
  display: {
    icon: "mailPlus",
    status: "status",
    subtitle: "expiresAt",
    title: "email",
  },
})
