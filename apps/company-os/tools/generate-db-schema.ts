import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { schemaSql } from "@/server/database/schema"

const target = fileURLToPath(new URL("../schema.sql", import.meta.url))
const content = schemaSql
if (process.argv.includes("--check")) {
  if (readFileSync(target, "utf8") !== content)
    throw new Error(
      "schema.sql differs from the declared storage. Run pnpm turbo run db:generate --filter=company-os."
    )
} else writeFileSync(target, content)
