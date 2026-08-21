import { sql } from "drizzle-orm"
import { check, index, text } from "drizzle-orm/pg-core"

import { objects } from "./objects"
import { pgTable } from "./table"

export const leads = pgTable(
  "leads",
  {
    id: text()
      .primaryKey()
      .references(() => objects.id, { onDelete: "cascade" }),
    name: text().notNull(),
    companyName: text().notNull(),
    email: text(),
    phone: text(),
    source: text()
      .$type<"inbound" | "other" | "outbound" | "referral" | "unknown">()
      .notNull()
      .default("unknown"),
    status: text()
      .$type<"disqualified" | "new" | "qualified" | "working">()
      .notNull()
      .default("new"),
  },
  (table) => [
    check(
      "leads_source_check",
      sql`${table.source} in ('unknown', 'inbound', 'outbound', 'referral', 'other')`
    ),
    check(
      "leads_status_check",
      sql`${table.status} in ('new', 'working', 'qualified', 'disqualified')`
    ),
    index("leads_email_idx")
      .on(sql`lower(${table.email})`)
      .where(sql`${table.email} is not null`),
  ]
)
