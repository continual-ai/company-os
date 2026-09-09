import { Effect } from "effect"

import { Asset } from "#/runtime/assets/model/asset.ts"
import { AssetPrecondition } from "#/runtime/assets/server/asset-error.ts"
import type { AssetReference } from "#/runtime/assets/server/references.ts"
import type { ModelContext } from "#/runtime/server/model-context.ts"
import type { Database } from "#/runtime/server/storage/database.ts"
import { insertValues } from "#/runtime/server/storage/index.ts"
import {
  sqlValue,
  projection,
  type SelectionRow,
  inValues,
} from "#/runtime/server/storage/index.ts"
import { assetReferences } from "#/runtime/server/storage/infrastructure.ts"

/** Transactional reference index: field values remain authoritative; foreign keys protect deletion. */
export function replaceAssetReferences(
  database: typeof Database.Service,
  recordId: string,
  references: ReadonlyArray<AssetReference>,
  context: typeof ModelContext.Service
) {
  const sql = database.sql

  return Effect.gen(function* () {
    if (references.length > 0) {
      const assets = context.table(Asset)
      const rowsFields = {
        id: sqlValue<string>(sql`${assets.columns.id}`),
        name: sqlValue<string>(sql`${assets.columns.name}`),
        state: sqlValue<string>(sql`${assets.columns.state}`),
        contentType: sqlValue<string>(sql`${assets.columns.contentType}`),
        size: sqlValue<number>(sql`${assets.columns.size}`),
      }
      const rows = yield* sql<
        SelectionRow<typeof rowsFields>
      >`select ${projection(rowsFields)}
          from ${assets}
          where ${inValues(
            sql,
            assets.columns.id,
            references.map((ref) => ref.assetId)
          )} for share`
      for (const reference of references) {
        const asset = rows.find((row) => row.id === reference.assetId)
        const accepted = reference.schema.accept
        if (
          !asset ||
          asset.state !== "ready" ||
          (reference.schema.kind === "image" &&
            !asset.contentType.startsWith("image/")) ||
          (reference.schema.maxBytes !== undefined &&
            asset.size > reference.schema.maxBytes) ||
          (accepted !== undefined &&
            !accepted.some((type) =>
              type.startsWith(".")
                ? asset.name.toLowerCase().endsWith(type.toLowerCase())
                : type.endsWith("/*")
                  ? asset.contentType.startsWith(type.slice(0, -1))
                  : type === asset.contentType
            ))
        )
          return yield* Effect.fail(
            new AssetPrecondition({
              field: reference.field,
              message:
                "Choose a completed file that meets this field's type and size limits.",
            })
          )
      }
    }
    yield* sql`delete
          from ${assetReferences}
          where ${assetReferences.columns.recordId} = ${recordId}`
    if (references.length > 0)
      yield* sql`insert into ${assetReferences} ${insertValues(
        sql,
        assetReferences,
        references.map((reference) => ({
          recordId: recordId,
          field: reference.field,
          assetId: reference.assetId,
        }))
      )}`
    return undefined
  })
}
