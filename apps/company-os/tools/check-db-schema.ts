import { readFileSync } from "node:fs"

import { schemaSql } from "#/app/server/database/schema.ts"

if (
  readFileSync(new URL("../schema.sql", import.meta.url), "utf8") !== schemaSql
)
  throw new Error(
    "schema.sql differs from the model. Run pnpm db:reset to rebuild disposable local storage and refresh the generated schema."
  )
