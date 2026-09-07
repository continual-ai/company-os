import { insertValues, assignments } from "@company/postgres"
import {
  conflictColumns,
  projection,
  type SelectionRow,
} from "@company/postgres"
import { Context, Effect, Layer } from "effect"

import { Database } from "@/server/database/database"
import { assetBlobs } from "@/server/database/schema"

/** Bounded private blobs. PostgreSQL keeps the default portable across current deployments. */
export class BlobStorage extends Context.Service<BlobStorage>()(
  "@company/BlobStorage",
  {
    make: Effect.gen(function* () {
      const database = yield* Database
      const sql = database.sql
      const selection = { bytes: assetBlobs.columns.bytes }
      return {
        put: (assetId: string, bytes: Uint8Array) =>
          sql`insert into ${assetBlobs} ${insertValues(sql, assetBlobs, { assetId, bytes })}
          on conflict (${conflictColumns(sql, assetBlobs.columns.assetId)})
          do update set ${assignments(sql, assetBlobs, { bytes })}`.pipe(
            Effect.asVoid
          ),
        get: (assetId: string) =>
          sql<SelectionRow<typeof selection>>`select ${projection(selection)}
          from ${assetBlobs}
          where ${assetBlobs.columns.assetId} = ${assetId}
          limit ${1}`.pipe(Effect.map((rows) => rows[0]?.bytes)),
      }
    }),
  }
) {
  static readonly layer = Layer.effect(this, this.make)
}
