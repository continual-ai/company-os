import { makeSchemaSql } from "@company/runtime/server/schema"

import { Model } from "#/app.model.ts"
export const schemaSql = makeSchemaSql(Model)
