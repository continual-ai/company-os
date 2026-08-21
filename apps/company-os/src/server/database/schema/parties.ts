import { text } from "drizzle-orm/pg-core"

import { objects } from "./objects"
import { pgTable } from "./table"

/** Relational target for records implementing Acme's Party interface. */
export const parties = pgTable("parties", {
  id: text()
    .primaryKey()
    .references(() => objects.id, { onDelete: "cascade" }),
})
