import { eq } from "drizzle-orm"
import { Context, Effect, Layer } from "effect"

import { Database } from "@/server/database/database"
import { assetBlobs } from "@/server/database/schema"

/** Bounded private blobs. PostgreSQL keeps the default portable across current deployments. */
export class BlobStorage extends Context.Service<BlobStorage>()(
  "@company/BlobStorage",
  {
    make: Effect.gen(function* () {
      const database = yield* Database
      return {
        put: (assetId: string, bytes: Uint8Array) =>
          database
            .insert(assetBlobs)
            .values({ assetId, bytes })
            .onConflictDoUpdate({ target: assetBlobs.assetId, set: { bytes } })
            .pipe(Effect.asVoid),
        get: (assetId: string) =>
          database
            .select({ bytes: assetBlobs.bytes })
            .from(assetBlobs)
            .where(eq(assetBlobs.assetId, assetId))
            .limit(1)
            .pipe(Effect.map((rows) => rows[0]?.bytes)),
      }
    }),
  }
) {
  static readonly layer = Layer.effect(this, this.make)
}
