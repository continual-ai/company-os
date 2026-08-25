import { Model } from "@company/model"
import { makePostgresSchema } from "@company/postgres"
import { text, timestamp } from "drizzle-orm/pg-core"

import * as BetterAuthSchema from "@/server/auth/auth-schema.generated"

export const Storage = makePostgresSchema(Model)

export const authSchema = BetterAuthSchema.authSchema
export const authUser = BetterAuthSchema.user
export const authSession = BetterAuthSchema.session
export const authAccount = BetterAuthSchema.account
export const authVerification = BetterAuthSchema.verification

// Drizzle Kit currently discovers top-level exported table instances. These
// aliases expose the generated projection without duplicating its definition.
export const objects = Storage.core.objects
export const recordAliases = Storage.core.recordAliases
export const platforms = Storage.core.roots
export const authorizationScopes = Storage.interfaces.authorizationScope
export const identities = Storage.interfaces.identity
export const parties = Storage.interfaces.party
export const principals = Storage.interfaces.principal
export const companies = Storage.objects.company
export const apiKeys = Storage.objects.apiKey
export const contacts = Storage.objects.contact
export const deals = Storage.objects.deal
export const groupMemberships = Storage.objects.groupMembership
export const groups = Storage.objects.group
export const interactions = Storage.objects.interaction
export const invitations = Storage.objects.invitation
export const leads = Storage.objects.lead
export const lineItems = Storage.objects.lineItem
export const roleAssignments = Storage.objects.roleAssignment
export const roles = Storage.objects.role
export const serviceAccounts = Storage.objects.serviceAccount
export const users = Storage.objects.user
export const relations = Storage.relations

export const authUserBindings = authSchema.table("user_binding", {
  authUserId: text("auth_user_id")
    .primaryKey()
    .references(() => authUser.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const invitationCredentials = authSchema.table("invitation_credential", {
  invitationId: text("invitation_id")
    .primaryKey()
    .references(() => invitations.id, { onDelete: "cascade" }),
  secretHash: text("secret_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
})

export const apiKeyCredentials = authSchema.table("api_key_credential", {
  apiKeyId: text("api_key_id")
    .primaryKey()
    .references(() => apiKeys.id, { onDelete: "cascade" }),
  secretHash: text("secret_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
})

export const betterAuthSchema = {
  user: authUser,
  session: authSession,
  account: authAccount,
  verification: authVerification,
} as const
