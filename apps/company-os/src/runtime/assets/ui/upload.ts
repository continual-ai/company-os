import type { Asset } from "#/runtime/assets/model/asset.ts"
import { modelData } from "#/runtime/client/data-client.ts"
import { executeMutation } from "#/runtime/client/model-query-client.ts"
import type { ObjectQueryClient } from "#/runtime/client/model-query-client.ts"
import { RecordId } from "#/runtime/model/index.ts"

function putUpload(
  url: string,
  file: File,
  signal: AbortSignal,
  progress: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    const abort = () => request.abort()
    request.open("PUT", url)
    request.withCredentials = true
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable)
        progress(Math.round((event.loaded / event.total) * 100))
    })
    request.addEventListener("load", () =>
      request.status >= 200 && request.status < 300
        ? resolve()
        : reject(
            new Error("The upload was rejected. Retry or choose another file.")
          )
    )
    request.addEventListener("error", () =>
      reject(new Error("The upload connection failed."))
    )
    request.addEventListener("abort", () =>
      reject(new DOMException("Upload canceled.", "AbortError"))
    )
    request.addEventListener("loadend", () =>
      signal.removeEventListener("abort", abort)
    )
    signal.addEventListener("abort", abort, { once: true })
    if (signal.aborted) {
      reject(new DOMException("Upload canceled.", "AbortError"))
      signal.removeEventListener("abort", abort)
      return
    }
    request.send(file)
  })
}

/** The single upload adapter used by generated and custom forms. */
export function createAssetUploader(
  asset: Pick<
    ObjectQueryClient<typeof Asset>,
    "beginUpload" | "completeUpload" | "delete"
  >
) {
  return async function uploadAsset(
    file: File,
    scope: string,
    signal: AbortSignal,
    progress: (percent: number) => void
  ) {
    const cache = modelData().queryClient
    const reserved = await executeMutation(cache, asset.beginUpload(), {
      scope: RecordId("authorizationScope")(scope),
      name: file.name,
      contentType: file.type || "application/octet-stream",
      size: file.size,
    })
    try {
      await putUpload(reserved.uploadUrl, file, signal, progress)
      await executeMutation(cache, asset.completeUpload(), {
        id: reserved.asset,
      })
      return { assetId: reserved.asset }
    } catch (error) {
      await executeMutation(cache, asset.delete(), {
        id: reserved.asset,
      }).catch(() => undefined)
      throw error
    }
  }
}
