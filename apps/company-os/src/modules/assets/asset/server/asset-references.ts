import { eq, inArray, sql } from "drizzle-orm"
import { Effect } from "effect"

import type { AssetReference } from "@/modules/assets/asset/references"
import type { Database } from "@/server/database/database"
import { assetReferences, assets } from "@/server/database/schema"

import { AssetPrecondition } from "./asset-error"

/** Transactional reference index: field values remain authoritative; foreign keys protect deletion. */
export function replaceAssetReferences(
  database: typeof Database.Service,
  recordId: string,
  references: ReadonlyArray<AssetReference>
) {
  return Effect.gen(function* () {
    if (references.length > 0) {
      const rows = yield* database
        .select({
          id: sql<string>`${assets.id}`,
          name: sql<string>`${assets.name}`,
          state: sql<string>`${assets.state}`,
          contentType: sql<string>`${assets.contentType}`,
          size: sql<number>`${assets.size}`,
        })
        .from(assets)
        .where(
          inArray(
            assets.id,
            references.map((ref) => ref.assetId)
          )
        )
        .for("share")
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
    yield* database
      .delete(assetReferences)
      .where(eq(assetReferences.recordId, recordId))
    if (references.length > 0)
      yield* database.insert(assetReferences).values(
        references.map((reference) => ({
          recordId: recordId,
          field: reference.field,
          assetId: reference.assetId,
        }))
      )
    return undefined
  })
}
