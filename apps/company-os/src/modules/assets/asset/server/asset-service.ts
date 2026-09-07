import { projection, type SelectionRow } from "@company/postgres"
import {
  RecordId,
  type ActionInput,
  type ObjectCreateInput,
  type ObjectGetInput,
} from "@company/runtime"
import { Model } from "company-os/model"
import { Context, Effect, Layer } from "effect"

import { BlobStorage } from "@/modules/assets/server/blob-storage"
import { Authorization } from "@/server/authorization/authorization-service"
import { Database } from "@/server/database/database"
import { assets } from "@/server/database/schema"
import { currentActorId } from "@/server/invocation-context"
import { ObjectRepositories } from "@/server/model/object-repositories"
import {
  makeObjectService,
  makeObjectWriter,
} from "@/server/model/object-service"
import { RecordIdentifierResolver } from "@/server/model/record-identifier-resolver"

import { AssetPrecondition } from "./asset-error"
import { inspectUpload } from "./inspect-upload"

const make = Effect.gen(function* () {
  const database = yield* Database
  const sql = database.sql
  const authorization = yield* Authorization
  const blobs = yield* BlobStorage
  const identifiers = yield* RecordIdentifierResolver
  const repository = (yield* ObjectRepositories).asset
  const base = yield* makeObjectService(Model.objects.asset, repository)
  const writer = yield* makeObjectWriter(Model.objects.asset, repository)

  const beginUpload = Effect.fn("@company/Assets.beginUpload")(function* (
    input: ActionInput<typeof Model.objects.asset.actions.beginUpload>
  ) {
    const scope = yield* identifiers.resolve("authorizationScope", input.scope)
    yield* authorization.requireOperation({
      objectType: "asset",
      operationId: "beginUpload",
      parentId: scope,
    })
    // SAFETY: the resolver verified this concrete record implements AuthorizationScope.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const parent = scope as unknown as ObjectCreateInput<
      typeof Model.objects.asset
    >["parent"]
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
    input: ObjectGetInput<typeof Model.objects.asset>
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
