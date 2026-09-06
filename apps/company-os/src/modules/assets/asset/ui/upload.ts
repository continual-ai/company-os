import { RecordId } from "@company/runtime"
import { Effect } from "effect"

import { client } from "@/app-client"

/** Stable authorized delivery path; never persist a signed or provider-specific URL. */
export function assetContentUrl(assetId: string) {
  return `/api/v1/assets/${encodeURIComponent(assetId)}/content`
}

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
export async function uploadAsset(
  file: File,
  scope: string,
  signal: AbortSignal,
  progress: (percent: number) => void
) {
  const reserved = await Effect.runPromise(
    client.asset.beginUpload({
      scope: RecordId("authorizationScope")(scope),
      name: file.name,
      contentType: file.type || "application/octet-stream",
      size: file.size,
    }),
    { signal }
  )
  try {
    await putUpload(reserved.uploadUrl, file, signal, progress)
    await Effect.runPromise(
      client.asset.completeUpload({ id: reserved.asset }),
      { signal }
    )
    return { assetId: reserved.asset }
  } catch (error) {
    // Cancellation cleanup uses a new request, independent of the aborted transfer.
    await Effect.runPromise(client.asset.delete({ id: reserved.asset })).catch(
      () => undefined
    )
    throw error
  }
}
