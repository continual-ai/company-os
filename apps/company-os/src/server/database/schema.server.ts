import { AcmeModel } from "@acme/api"
import { makePostgresSchema } from "@continual/postgres"
import { sql } from "drizzle-orm"
import { index, text } from "drizzle-orm/pg-core"

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
  },
})

// Drizzle Kit currently discovers top-level exported table instances. These
// aliases expose the generated projection without duplicating its definition.
export const objects = AcmeStorage.core.objects
export const objectAliases = AcmeStorage.core.objectAliases
export const roots = AcmeStorage.core.roots
export const parties = AcmeStorage.interfaces.party
export const companies = AcmeStorage.objects.company
export const contacts = AcmeStorage.objects.contact
export const deals = AcmeStorage.objects.deal
export const interactions = AcmeStorage.objects.interaction
export const leads = AcmeStorage.objects.lead
export const lineItems = AcmeStorage.objects.lineItem
export const relations = AcmeStorage.relations
