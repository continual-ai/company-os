import { sql } from "drizzle-orm"
import { check, index, jsonb, text } from "drizzle-orm/pg-core"

import { objects } from "./objects"
import { pgTable } from "./table"

export const companies = pgTable(
  "companies",
  {
    id: text()
      .primaryKey()
      .references(() => objects.id, { onDelete: "cascade" }),
    logo: jsonb().$type<unknown>(),
    name: text().notNull(),
    domain: text(),
    website: text(),
    industry: text(),
    lifecycleStage: text()
      .$type<"customer" | "inactive" | "prospect">()
      .notNull()
      .default("prospect"),
  },
  (table) => [
    check(
      "companies_lifecycle_stage_check",
      sql`${table.lifecycleStage} in ('prospect', 'customer', 'inactive')`
    ),
    index("companies_domain_idx")
      .on(sql`lower(${table.domain})`)
      .where(sql`${table.domain} is not null`),
  ]
)
