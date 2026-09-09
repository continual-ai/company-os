import { Model } from "#/app.model.ts"
import { makeSchemaSql } from "#/runtime/server/schema.ts"
import { makePostgresSchema } from "#/runtime/server/storage/index.ts"

/** Physical storage projection of the composed model. */
export const Storage = makePostgresSchema(Model)
export const schemaSql = makeSchemaSql(Model)
