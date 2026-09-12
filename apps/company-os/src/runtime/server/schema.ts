import type { ModelCatalog } from "#/runtime/model/index.ts"
import { infrastructureStatements } from "#/runtime/server/storage/infrastructure.ts"
import { makePostgresSchema } from "#/runtime/server/storage/schema.ts"

/** Deterministic SQL projection used by migrations and isolated test databases. */
export function makeSchemaSql(model: ModelCatalog) {
  return (
    "-- Company OS: desired PostgreSQL schema\n" +
    "-- Generated from the model. Edit model or runtime storage source,\n" +
    "-- then run db:reset.\n" +
    "-- Domain tables share their record identity with objects.\n" +
    "-- Descriptions are documentation only; they are not stored in PostgreSQL.\n\n" +
    [...makePostgresSchema(model).ddl, ...infrastructureStatements]
      .map((statement, index, statements) => {
        const previous = statements[index - 1]
        const adjacent =
          (statement.startsWith("create table ") &&
            previous?.startsWith("--")) ||
          (/^create (unique )?index /.test(statement) &&
            /^create (unique )?index /.test(previous ?? ""))
        const separator = index === 0 ? "" : adjacent ? "\n" : "\n\n"
        return (
          separator + (statement.startsWith("--") ? statement : `${statement};`)
        )
      })
      .join("") +
    "\n"
  )
}
