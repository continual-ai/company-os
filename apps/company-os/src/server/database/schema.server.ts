import { AcmeModel } from "@acme/api"
import { makePostgresSchema } from "@continual/postgres"
import { sql } from "drizzle-orm"
import { index, text, uniqueIndex } from "drizzle-orm/pg-core"

export const AcmeStorage = makePostgresSchema(AcmeModel, {
  objects: {
    company: {
      indexes: ({ domain }) => [
        index("companies_domain_idx")
          .on(sql`lower(${domain})`)
          .where(sql`${domain} is not null`),
      ],
    },
    contact: {
      columns: {
        name: () =>
          text()
            .notNull()
            .generatedAlwaysAs(sql`trim(first_name || ' ' || last_name)`),
      },
      indexes: ({ email }) => [
        index("contacts_email_idx")
          .on(sql`lower(${email})`)
          .where(sql`${email} is not null`),
      ],
    },
    groupMembership: {
      indexes: ({ memberId, parentId }) => [
        uniqueIndex("group_memberships_parent_id_member_id_unique").on(
          parentId,
          memberId
        ),
      ],
    },
    interaction: {
      indexes: ({ occurredAt }) => [
        index("interactions_occurred_at_idx").on(occurredAt),
      ],
    },
    lead: {
      indexes: ({ email }) => [
        index("leads_email_idx")
          .on(sql`lower(${email})`)
          .where(sql`${email} is not null`),
      ],
    },
    roleAssignment: {
      indexes: ({ parentId, principalId, roleId }) => [
        uniqueIndex(
          "role_assignments_parent_id_principal_id_role_id_unique"
        ).on(parentId, principalId, roleId),
      ],
    },
    role: {
      columns: {
        permissions: () => text().array().notNull(),
      },
    },
  },
})

// Drizzle Kit currently discovers top-level exported table instances. These
// aliases expose the generated projection without duplicating its definition.
export const objects = AcmeStorage.core.objects
export const recordAliases = AcmeStorage.core.recordAliases
export const platforms = AcmeStorage.core.roots
export const authorizationScopes = AcmeStorage.interfaces.authorizationScope
export const identities = AcmeStorage.interfaces.identity
export const parties = AcmeStorage.interfaces.party
export const principals = AcmeStorage.interfaces.principal
export const companies = AcmeStorage.objects.company
export const contacts = AcmeStorage.objects.contact
export const deals = AcmeStorage.objects.deal
export const groupMemberships = AcmeStorage.objects.groupMembership
export const groups = AcmeStorage.objects.group
export const interactions = AcmeStorage.objects.interaction
export const leads = AcmeStorage.objects.lead
export const lineItems = AcmeStorage.objects.lineItem
export const roleAssignments = AcmeStorage.objects.roleAssignment
export const roles = AcmeStorage.objects.role
export const serviceAccounts = AcmeStorage.objects.serviceAccount
export const users = AcmeStorage.objects.user
export const relations = AcmeStorage.relations
