import { sql } from "drizzle-orm"
import { check, index, jsonb, text } from "drizzle-orm/pg-core"

import { companies } from "./companies"
import { objects } from "./objects"
import { pgTable } from "./table"

export const deals = pgTable(
  "deals",
  {
    id: text()
      .primaryKey()
      .references(() => objects.id, { onDelete: "cascade" }),
    companyId: text()
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    name: text().notNull(),
    stage: text()
      .$type<
        "discovery" | "lost" | "negotiation" | "proposal" | "qualified" | "won"
      >()
      .notNull()
      .default("discovery"),
    amount: jsonb().$type<unknown>(),
    expectedCloseDate: text(),
  },
  (table) => [
    check(
      "deals_stage_check",
      sql`${table.stage} in (
        'discovery',
        'qualified',
        'proposal',
        'negotiation',
        'won',
        'lost'
      )`
    ),
    index("deals_company_id_idx").on(table.companyId),
  ]
)
