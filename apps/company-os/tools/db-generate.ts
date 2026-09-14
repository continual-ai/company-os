import { writeFileSync } from "node:fs"

import { schemaSql } from "#/app/server/database/schema.ts"

writeFileSync(new URL("../schema.sql", import.meta.url), schemaSql)
console.log("Generated schema.sql from the model.")
