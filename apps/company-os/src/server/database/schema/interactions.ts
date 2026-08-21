import { sql } from "drizzle-orm"
import { check, index, text } from "drizzle-orm/pg-core"

import { objects } from "./objects"
import { parties } from "./parties"
import { pgTable } from "./table"

export const interactions = pgTable(
  "interactions",
  {
    id: text()
      .primaryKey()
      .references(() => objects.id, { onDelete: "cascade" }),
    subjectId: text()
      .notNull()
      .references(() => parties.id, { onDelete: "restrict" }),
    kind: text()
      .$type<"call" | "email" | "meeting" | "note">()
      .notNull()
      .default("note"),
    occurredAt: text().notNull(),
    summary: text().notNull(),
    details: text(),
  },
  (table) => [
    check(
      "interactions_kind_check",
      sql`${table.kind} in ('note', 'email', 'call', 'meeting')`
    ),
    index("interactions_subject_id_idx").on(table.subjectId),
    index("interactions_occurred_at_idx").on(table.occurredAt),
  ]
)
