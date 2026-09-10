import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { basename } from "node:path"
import { fileURLToPath } from "node:url"

import { Effect } from "effect"

import { AssetService } from "#/runtime/assets/server/asset-service.ts"

/** Reuses identical files within the project; new files follow the private upload lifecycle. Call inside a seed scenario transaction. */
export const importSeedAsset = Effect.fn("@company/importSeedAsset")(function* (
  file: URL,
  contentType: string
) {
  const bytes = yield* Effect.tryPromise(() => readFile(file))
  const assets = yield* AssetService
  const name = basename(fileURLToPath(file))
  const checksum = createHash("sha256").update(bytes).digest("hex")
  const existing = yield* assets.list({
    pageSize: 1,
    filter: {
      and: [
        { field: "checksum", operator: "eq", value: checksum },
        { field: "name", operator: "eq", value: name },
        { field: "state", operator: "eq", value: "ready" },
      ],
    },
  })
  if (existing.items[0] !== undefined) return { assetId: existing.items[0].id }
  const upload = yield* assets.beginUpload({
    name,
    contentType,
    size: bytes.byteLength,
  })
  yield* assets.put(upload.asset, bytes)
  yield* assets.completeUpload({ id: upload.asset })
  return { assetId: upload.asset }
})
