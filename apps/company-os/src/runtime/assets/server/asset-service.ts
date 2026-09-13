import { Context, Effect, Layer } from "effect"

import { type BeginAssetUpload, Asset } from "#/runtime/assets/model/asset.ts"
import { AssetPrecondition } from "#/runtime/assets/server/asset-error.ts"
import { BlobStorage } from "#/runtime/assets/server/blob-storage.ts"
import { inspectUpload } from "#/runtime/assets/server/inspect-upload.ts"
import {
  RecordId,
  type ActionInput,
  type ObjectGetInput,
} from "#/runtime/model/index.ts"
import { requireProjectAccess } from "#/runtime/server/auth/project-access.ts"
import { Database } from "#/runtime/server/database.ts"
import { currentActorId } from "#/runtime/server/invocation-context.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"
import { RecordIdentifiers } from "#/runtime/server/storage/identifiers.ts"
import {
  projection,
  type SelectionRow,
} from "#/runtime/server/storage/index.ts"
import { RecordStore } from "#/runtime/server/storage/record-store.ts"
import { SqlDatabase } from "#/runtime/server/storage/transactions.ts"

const make = Effect.gen(function* () {
  const assets = (yield* ModelContext).table(Asset)
  const database = yield* SqlDatabase
  const sql = database.sql
  const blobs = yield* BlobStorage
  const identifiers = yield* RecordIdentifiers
  const records = yield* RecordStore
  const repository = records.get(Asset)
  const base = (yield* Database).repository(Asset)
  const writer = (yield* Database).repository(Asset)

  const beginUpload = Effect.fn("@company/Assets.beginUpload")(function* (
    input: ActionInput<typeof BeginAssetUpload>
  ) {
    yield* requireProjectAccess
    const record = yield* writer.create({
      name: input.name,
      contentType: input.contentType,
      size: input.size,
    })
    return {
      asset: record.id,
      uploadUrl: `/api/v1/assets/${record.id}/content`,
    }
  })

  const lockFields = { id: assets.columns.id }
  const lock = (id: string) =>
    sql<SelectionRow<typeof lockFields>>`select ${projection(lockFields)}
          from ${assets}
          where ${assets.columns.id} = ${id} for update`
  const requireUploader = Effect.fn("@company/Assets.requireUploader")(
    function* (id: string) {
      yield* requireProjectAccess
      const record = yield* repository.get(RecordId("asset")(id))
      if (record.createdBy !== (yield* currentActorId))
        return yield* Effect.fail(
          new AssetPrecondition({
            message: "Only the upload's creator may supply its content.",
          })
        )
      return record
    }
  )

  const put = Effect.fn("@company/Assets.put")(function* (
    id: string,
    bytes: Uint8Array
  ) {
    return yield* database.transaction(() =>
      Effect.gen(function* () {
        yield* lock(id)
        const record = yield* requireUploader(id)
        if (record.state !== "pending")
          return yield* Effect.fail(
            new AssetPrecondition({
              message: "A completed asset cannot be overwritten.",
            })
          )
        if (bytes.byteLength !== record.size)
          return yield* Effect.fail(
            new AssetPrecondition({
              message: "The upload size does not match the reserved asset.",
            })
          )
        return yield* blobs.put(id, bytes)
      })
    )
  })

  const completeUpload = Effect.fn("@company/Assets.completeUpload")(function* (
    input: ObjectGetInput<typeof Asset>
  ) {
    const id = yield* identifiers.resolve("asset", input.id)
    return yield* database.transaction(() =>
      Effect.gen(function* () {
        yield* lock(id)
        const record = yield* requireUploader(id)
        if (record.state === "ready") return { asset: record.id }
        const bytes = yield* blobs.get(id)
        if (bytes === undefined || bytes.byteLength !== record.size)
          return yield* Effect.fail(
            new AssetPrecondition({
              message: "Upload the complete file before finishing.",
            })
          )
        const metadata = yield* inspectUpload(bytes, record.contentType)
        yield* writer.update({
          id: record.id,
          etag: record.etag,
          state: "ready",
          ...metadata,
        })
        return { asset: record.id }
      })
    )
  })

  const content = Effect.fn("@company/Assets.content")(function* (id: string) {
    yield* requireProjectAccess
    const record = yield* base.get({ id: RecordId("asset")(id) })
    if (record.state !== "ready")
      return yield* Effect.fail(
        new AssetPrecondition({ message: "This upload is not ready." })
      )
    const bytes = yield* blobs.get(id)
    if (bytes === undefined)
      return yield* Effect.fail(
        new AssetPrecondition({ message: "The stored content is unavailable." })
      )
    return { record, bytes }
  })

  return { ...base, beginUpload, completeUpload, put, content }
})

/** Governed upload lifecycle; every transport uses the same implementation. */
export class AssetService extends Context.Service<AssetService>()(
  "@company/Assets",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
