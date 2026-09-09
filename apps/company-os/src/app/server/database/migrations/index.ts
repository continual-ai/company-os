import { initialMigration } from "#/app/server/database/migrations/0001-initial.ts"
import { hiringMigration } from "#/app/server/database/migrations/0002-hiring.ts"
/** Append numbered migrations here when retaining business data. */
export const migrations = [initialMigration, hiringMigration] as const
