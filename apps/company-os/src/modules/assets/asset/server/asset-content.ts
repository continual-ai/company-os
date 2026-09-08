import { CurrentInvocation } from "@company/runtime/effect/object-service"
import { Effect } from "effect"

import { AssetPrecondition } from "#/modules/assets/asset/server/asset-error.ts"
import { AssetService } from "#/modules/assets/asset/server/asset-service.ts"
import { applicationRuntime } from "#/server/application-runtime.ts"
import { Authentication } from "#/server/auth/authentication.ts"

async function readUpload(request: Request): Promise<Uint8Array> {
  if (!request.body) throw new Error("Missing upload body.")
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const part = await reader.read()
      if (part.done) break
      size += part.value.byteLength
      if (size > 25_000_000) {
        await reader.cancel()
        throw new Error("Files must be at most 25 MB.")
      }
      chunks.push(part.value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

/** Binary transport adapter; model operations remain in the generated HTTP contract. */
export function handleAssetContent(
  request: Request,
  id: string
): Promise<Response> {
  return applicationRuntime.runPromise(
    Effect.gen(function* () {
      const authentication = yield* Authentication
      const service = yield* AssetService
      const invocation = yield* authentication.invocation(request.headers)
      return yield* Effect.gen(function* () {
        if (request.method === "PUT") {
          const bytes = yield* Effect.tryPromise({
            try: () => readUpload(request),
            catch: () =>
              new AssetPrecondition({
                message: "Upload a complete file of at most 25 MB.",
              }),
          })
          yield* service.put(id, bytes)
          return new Response(null, { status: 204 })
        }
        const { record, bytes } = yield* service.content(id)
        const disposition = record.contentType.startsWith("image/")
          ? "inline"
          : "attachment"
        return new Response(new Uint8Array(bytes), {
          headers: {
            "content-type":
              disposition === "inline"
                ? record.contentType
                : "application/octet-stream",
            "content-length": String(bytes.byteLength),
            "content-disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(record.name)}`,
            "cache-control": "private, no-store",
            "x-content-type-options": "nosniff",
            "content-security-policy": "default-src 'none'; sandbox",
          },
        })
      }).pipe(Effect.provideService(CurrentInvocation, invocation))
    }).pipe(
      Effect.catch((error) => {
        const tag =
          typeof error === "object" && error !== null && "_tag" in error
            ? error._tag
            : undefined
        const status =
          tag === "AssetPrecondition"
            ? 409
            : tag === "InvalidIdentityAssertion"
              ? 401
              : tag === "PermissionDenied"
                ? 403
                : tag === "AuthorizationTargetNotFound" ||
                    tag === "ObjectNotFound"
                  ? 404
                  : 500
        return Effect.succeed(
          Response.json(
            {
              message:
                status === 409 && error instanceof AssetPrecondition
                  ? error.message
                  : "The asset request could not be completed.",
            },
            { status }
          )
        )
      })
    )
  )
}
