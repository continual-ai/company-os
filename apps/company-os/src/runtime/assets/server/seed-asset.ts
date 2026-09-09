import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { basename } from "node:path"
import { fileURLToPath } from "node:url"

import { Effect } from "effect"

import type { Asset } from "#/runtime/assets/model/asset.ts"
import { AssetService } from "#/runtime/assets/server/asset-service.ts"
import { RecordId, type ActionInput } from "#/runtime/model/index.ts"
import { RecordIdentifierResolver } from "#/runtime/server/model/record-identifier-resolver.ts"

type UploadInput = ActionInput<typeof Asset.actions.beginUpload>

/** Reuses identical files within a scope; new files follow the private upload lifecycle. Call inside a seed scenario transaction. */
export const importSeedAsset = Effect.fn("@company/importSeedAsset")(function* (
  file: URL,
  scope: UploadInput["scope"],
  contentType: string
) {
  const parent = RecordId("authorizationScope")(
    yield* (yield* RecordIdentifierResolver).resolve(
      "authorizationScope",
      scope
    )
  )
  const bytes = yield* Effect.tryPromise(() => readFile(file))
  const assets = yield* AssetService
  const name = basename(fileURLToPath(file))
  const checksum = createHash("sha256").update(bytes).digest("hex")
  const existing = yield* assets.list({
    pageSize: 1,
    filter: {
      and: [
        { field: "parent", operator: "eq", value: parent },
        { field: "checksum", operator: "eq", value: checksum },
        { field: "name", operator: "eq", value: name },
        { field: "state", operator: "eq", value: "ready" },
      ],
    },
  })
  if (existing.items[0] !== undefined) return { assetId: existing.items[0].id }
  const upload = yield* assets.beginUpload({
    scope,
    name,
    contentType,
    size: bytes.byteLength,
  })
  yield* assets.put(upload.asset, bytes)
  yield* assets.completeUpload({ id: upload.asset })
  return { assetId: upload.asset }
})
