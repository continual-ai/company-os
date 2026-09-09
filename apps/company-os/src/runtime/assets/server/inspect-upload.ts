import { Effect } from "effect"
import { fileTypeFromBuffer } from "file-type"
import { imageSize } from "image-size"

import { AssetPrecondition } from "#/runtime/assets/server/asset-error.ts"

const inlineImages = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
])

/** Detects file metadata from bytes. Signature inspection is not malware scanning. */
export const inspectUpload = Effect.fn("@company/Assets.inspectUpload")(
  function* (bytes: Uint8Array, declaredType: string) {
    const detected = yield* Effect.tryPromise({
      try: (signal) => fileTypeFromBuffer(bytes, { signal }),
      catch: () =>
        new AssetPrecondition({
          message: "The file header could not be decoded.",
        }),
    }).pipe(Effect.catch(() => Effect.succeed(undefined)))
    let contentType = detected?.mime ?? "application/octet-stream"
    let width: number | null = null
    let height: number | null = null
    if (inlineImages.has(contentType)) {
      const dimensions = yield* Effect.try({
        try: () => imageSize(bytes),
        catch: () =>
          new AssetPrecondition({ message: "The image could not be decoded." }),
      })
      if (dimensions.width * dimensions.height > 40_000_000)
        return yield* Effect.fail(
          new AssetPrecondition({
            message: "Images must not exceed 40 megapixels.",
          })
        )
      width = dimensions.width
      height = dimensions.height
    } else if (declaredType.startsWith("image/")) {
      return yield* Effect.fail(
        new AssetPrecondition({
          message: "Use a valid PNG, JPEG, WebP, or GIF image.",
        })
      )
    } else if (contentType.startsWith("image/")) {
      contentType = "application/octet-stream"
    } else if (detected === undefined && declaredType.startsWith("text/")) {
      const text = yield* Effect.try({
        try: () => new TextDecoder("utf-8", { fatal: true }).decode(bytes),
        catch: () =>
          new AssetPrecondition({
            message: "The file is not valid UTF-8 text.",
          }),
      })
      if (!text.includes("\0")) contentType = declaredType
    }
    const checksum = yield* Effect.promise(async () => {
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new Uint8Array(bytes)
      )
      return Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0")
      ).join("")
    })
    return { contentType, width, height, checksum }
  }
)
