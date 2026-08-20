import { pgTableCreator } from "drizzle-orm/pg-core"

/** Acme uses TypeScript property names and conventional snake_case SQL names. */
export const pgTable = pgTableCreator((name) => name, "snake_case")
