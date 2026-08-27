import { Model } from "@company/model"
import { makePostgresSchema } from "@company/postgres"
import { pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core"

export const Storage = makePostgresSchema(Model)

// Drizzle Kit currently discovers top-level exported table instances. These
// aliases expose the generated projection without duplicating its definition.
export const objects = Storage.core.objects
export const recordAliases = Storage.core.recordAliases
export const roots = Storage.core.roots
export const actors = Storage.interfaces.actor
export const authorizationScopes = Storage.interfaces.authorizationScope
export const identities = Storage.interfaces.identity
export const parties = Storage.interfaces.party
export const principals = Storage.interfaces.principal
export const principalSets = Storage.objects.principalSet
export const anonymousActors = Storage.objects.anonymousActor
export const companies = Storage.objects.company
export const contacts = Storage.objects.contact
export const deals = Storage.objects.deal
export const groupMemberships = Storage.objects.groupMembership
export const groups = Storage.objects.group
export const interactions = Storage.objects.interaction
export const leads = Storage.objects.lead
export const lineItems = Storage.objects.lineItem
export const roleAssignments = Storage.objects.roleAssignment
export const roles = Storage.objects.role
export const serviceAccounts = Storage.objects.serviceAccount
export const users = Storage.objects.user
export const contactPrimaryCompanies = Storage.linkTables.contactPrimaryCompany
export const interactionRegarding = Storage.linkTables.interactionRegarding
export const relations = Storage.relations

/** Stable external-subject mappings; credentials and sessions remain outside Company OS. */
export const identityBindings = pgTable(
  "identity_bindings",
  {
    issuer: text("issuer").notNull(),
    subject: text("subject").notNull(),
    identityId: text("identity_id")
      .notNull()
      .references(() => identities.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.issuer, table.subject] })]
)
