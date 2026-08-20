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
    jobTitle: text().notNull().default(""),
    email: text().notNull().default(""),
    phone: text().notNull().default(""),
  },
  (table) => [
    index("contacts_primary_company_id_idx").on(table.primaryCompanyId),
    index("contacts_email_idx")
      .on(sql`lower(${table.email})`)
      .where(sql`${table.email} <> ''`),
  ]
)
