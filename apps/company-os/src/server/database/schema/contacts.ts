import { sql } from "drizzle-orm"
import { index, jsonb, text } from "drizzle-orm/pg-core"

import { companies } from "./companies"
import { objects } from "./objects"
import { pgTable } from "./table"

export const contacts = pgTable(
  "contacts",
  {
    id: text()
      .primaryKey()
      .references(() => objects.id, { onDelete: "cascade" }),
    photo: jsonb().$type<unknown>(),
    primaryCompanyId: text().references(() => companies.id, {
      onDelete: "restrict",
    }),
    firstName: text().notNull(),
    lastName: text().notNull(),
    name: text()
      .notNull()
      .generatedAlwaysAs(sql`trim(first_name || ' ' || last_name)`),
    jobTitle: text(),
    email: text(),
    phone: text(),
  },
  (table) => [
    index("contacts_primary_company_id_idx").on(table.primaryCompanyId),
    index("contacts_email_idx")
      .on(sql`lower(${table.email})`)
      .where(sql`${table.email} is not null`),
  ]
)
