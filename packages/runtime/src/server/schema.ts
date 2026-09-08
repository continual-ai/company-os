import type { ModelCatalog } from "#/model/index.ts"
import { infrastructureStatements } from "#/server/database/schema.ts"
import { makePostgresSchema } from "#/server/postgres/schema.ts"

/** Deterministic SQL projection used by migrations and isolated test databases. */
export function makeSchemaSql(model: ModelCatalog) {
  return (
    "-- Generated current schema. Edit the model or runtime storage definitions.\n\n" +
    [...makePostgresSchema(model).ddl, ...infrastructureStatements]
      .map((statement) =>
        statement.startsWith("--") ? statement : `${statement};`
      )
      .join("\n\n") +
    "\n"
  )
}
