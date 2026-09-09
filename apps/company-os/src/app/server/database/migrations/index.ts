import { readFileSync, readdirSync } from "node:fs"

import { readMigrationFile } from "#/app/server/database/migration-file.ts"

// Vite embeds SQL in the server artifact; tsx administration tools read the same source files.
const files = import.meta.env
  ? import.meta.glob<string>("./*.sql", {
      query: "?raw",
      import: "default",
      eager: true,
    })
  : Object.fromEntries(
      readdirSync(new URL(".", import.meta.url))
        .filter((file) => file.endsWith(".sql"))
        .map((file) => [
          `./${file}`,
          readFileSync(new URL(file, import.meta.url), "utf8"),
        ])
    )

export const migrations = Object.entries(files)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([file, source], index) => {
    const migration = readMigrationFile(file.slice(2), source)
    if (migration.id !== index + 1)
      throw new Error(
        "SQL migrations must have consecutive IDs starting at 0001."
      )
    return migration
  })
