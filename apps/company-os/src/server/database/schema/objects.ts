import { sql } from "drizzle-orm"
import {
  type AnyPgColumn,
  check,
  index,
  jsonb,
  text,
} from "drizzle-orm/pg-core"

import { pgTable } from "./table"

export const objects = pgTable(
  "objects",
  {
    id: text().primaryKey(),
    kind: text()
      .$type<"company" | "contact" | "deal" | "interaction" | "lead" | "root">()
      .notNull(),
    parentId: text().references((): AnyPgColumn => objects.id, {
      onDelete: "restrict",
    }),
    ancestorIds: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    annotations: jsonb()
      .$type<Readonly<Record<string, string>>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    etag: text().notNull(),
    createdAt: text().notNull(),
    createdById: text().notNull(),
    updatedAt: text().notNull(),
    updatedById: text().notNull(),
  },
  (table) => [
    check(
      "objects_kind_check",
      sql`${table.kind} in ('root', 'company', 'contact', 'deal', 'lead', 'interaction')`
    ),
    check(
      "objects_parent_required",
      sql`(${table.kind} = 'root' and ${table.parentId} is null)
        or (${table.kind} <> 'root' and ${table.parentId} is not null)`
    ),
    index("objects_kind_idx").on(table.kind),
    index("objects_parent_id_idx").on(table.parentId),
    index("objects_ancestor_ids_idx").using("gin", table.ancestorIds),
  ]
)
