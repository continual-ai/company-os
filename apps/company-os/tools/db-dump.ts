import { writeFile } from "node:fs/promises"

import { Config, Effect, Redacted } from "effect"

import { databaseSchemaConfig } from "@/server/database/postgres"
import { dumpSchema } from "@/server/database/schema-dump"

import { loadLocalEnvironment } from "./local-environment"

loadLocalEnvironment()
const { url, schema } = await Effect.runPromise(
  Config.all({
    url: Config.redacted("DATABASE_URL"),
    schema: databaseSchemaConfig,
  })
)
await writeFile(
  new URL("../schema.actual.sql", import.meta.url),
  await dumpSchema(Redacted.value(url), schema)
)
console.log("Wrote schema.actual.sql (schema only; no data).")
