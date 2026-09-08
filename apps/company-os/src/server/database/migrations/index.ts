import { initialMigration } from "#/server/database/migrations/0001-initial.ts"
/** Append numbered migrations here when retaining business data. */
export const migrations = [initialMigration] as const
