import { Context, Effect, Layer } from "effect"

import { Asset } from "#/model/asset.ts"
import {
  RecordId,
  type ActionInput,
  type ObjectGetInput,
} from "#/model/index.ts"
import { AssetPrecondition } from "#/server/assets/asset-error.ts"
import { BlobStorage } from "#/server/assets/blob-storage.ts"
import { inspectUpload } from "#/server/assets/inspect-upload.ts"
import { Authorization } from "#/server/authorization/authorization-service.ts"
import { Database } from "#/server/database/database.ts"
import { currentActorId } from "#/server/invocation-context.ts"
import { ModelContext } from "#/server/model-context.ts"
import { ObjectRepositories } from "#/server/model/object-repositories.ts"
import { makeObjectService } from "#/server/model/object-service.ts"
import { RecordIdentifierResolver } from "#/server/model/record-identifier-resolver.ts"
import { projection, type SelectionRow } from "#/server/postgres/index.ts"

const make = Effect.gen(function* () {
  const assets = (yield* ModelContext).table(Asset)
  const database = yield* Database
  const sql = database.sql
  const authorization = yield* Authorization
  const blobs = yield* BlobStorage
  const identifiers = yield* RecordIdentifierResolver
  const records = yield* ObjectRepositories
  const repository = records.get(Asset)
  const base = yield* makeObjectService(Asset, repository)
  const writer = records.writer(Asset)

  const beginUpload = Effect.fn("@company/Assets.beginUpload")(function* (
    input: ActionInput<typeof Asset.actions.beginUpload>
  ) {
    const scope = yield* identifiers.resolve("authorizationScope", input.scope)
    yield* authorization.requireOperation({
      objectType: "asset",
      operationId: "beginUpload",
      parentId: scope,
    })
    const parent = scope
    const record = yield* writer.create({
      parent,
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
      yield* authorization.requireOperation({
        objectType: "asset",
        operationId: "completeUpload",
        recordIds: [id],
      })
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
