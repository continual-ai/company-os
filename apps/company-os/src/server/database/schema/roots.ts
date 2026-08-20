import { text } from "drizzle-orm/pg-core"

import { objects } from "./objects"
import { pgTable } from "./table"

export const roots = pgTable("roots", {
  id: text()
    .primaryKey()
    .references(() => objects.id, { onDelete: "cascade" }),
})
