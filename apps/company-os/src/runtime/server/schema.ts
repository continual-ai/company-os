import type { ModelCatalog } from "#/runtime/model/index.ts"
import { infrastructureStatements } from "#/runtime/server/storage/infrastructure.ts"
import { makePostgresSchema } from "#/runtime/server/storage/schema.ts"

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
